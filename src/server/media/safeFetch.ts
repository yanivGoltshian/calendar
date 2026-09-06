import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request } from 'node:https';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { MAX_SOURCE_IMAGE_BYTES } from '@/lib/media';

/** Fail closed for IPv6 except global unicast; reject transition/mapped addresses. */
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99) || (b === 2))) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase();
  return /^[23][0-9a-f]{3}:/.test(normalized) &&
    !normalized.startsWith('2001:') && !normalized.startsWith('2002:') &&
    !normalized.startsWith('3fff:') && !normalized.includes('.');
}

export function allowedImageOrigins(): string[] {
  // Server-only deployment configuration. Never accept tenant-selected origins.
  const origins = (process.env.MEDIA_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const connection = process.env.MEDIA_STORAGE_CONNECTION ?? '';
  const account = /(?:^|;)AccountName=([a-z0-9]+)(?:;|$)/i.exec(connection)?.[1];
  const endpoint = /(?:^|;)BlobEndpoint=([^;]+)/i.exec(connection)?.[1];
  if (endpoint) {
    try { const url = new URL(endpoint); if (url.protocol === 'https:') origins.push(url.origin); } catch {}
  } else if (account) origins.push(`https://${account}.blob.core.windows.net`);
  return origins;
}

export function permittedRemoteImage(value: string, origins = allowedImageOrigins()): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      !origins.includes(url.origin) || (url.port && url.port !== '443')) return null;
    return url;
  } catch { return null; }
}

export async function readSafeImage(source: string): Promise<Buffer> {
  if (source.length > 2048) throw new Error('image_url');
  if (source.startsWith('/')) {
    // Only owned public assets, never an HTTP fetch to arbitrary application routes.
    if (!/^\/(?:brand|icons|images)\/[A-Za-z0-9/_\-.]+$/.test(source) || source.split('/').includes('..')) throw new Error('image_path');
    const root = await realpath(path.join(process.cwd(), 'public'));
    const file = await realpath(path.join(root, source));
    if (!file.startsWith(path.join(root, source.split('/')[1]) + path.sep)) throw new Error('image_path');
    if ((await stat(file)).size > MAX_SOURCE_IMAGE_BYTES) throw new Error('image_size');
    return readFile(file);
  }
  const url = permittedRemoteImage(source);
  if (!url) throw new Error('image_origin');
  return fetchPinnedImage(url);
}

export async function fetchPinnedImage(url: URL, dependencies: {
  resolve?: (hostname: string) => Promise<{ address: string; family: number }[]>;
  request?: typeof request;
} = {}): Promise<Buffer> {
  const deadline = AbortSignal.timeout(8000);
  const addresses = await Promise.race([
    dependencies.resolve ? dependencies.resolve(url.hostname) : lookup(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => deadline.addEventListener('abort', () => reject(new Error('image_timeout')), { once: true })),
  ]);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error('image_address');
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    // Pin the checked address; a second DNS lookup would permit DNS rebinding.
    const req = (dependencies.request ?? request)(url, {
      signal: deadline,
      family: pinned.family,
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      headers: { Accept: 'image/jpeg,image/png,image/webp' },
    }, (res) => {
      // Redirects are not followed, even to another allowed origin.
      if (res.statusCode !== 200 || !/^image\/(?:png|jpeg|webp)(?:;|$)/i.test(res.headers['content-type'] ?? '') ||
        Number(res.headers['content-length'] ?? 0) > MAX_SOURCE_IMAGE_BYTES) {
        res.destroy();
        reject(new Error('image_response'));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_SOURCE_IMAGE_BYTES) {
          res.destroy(new Error('image_size'));
        } else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.end();
  });
}
