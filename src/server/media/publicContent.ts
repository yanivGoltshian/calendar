import { createHash } from 'node:crypto';
import { MAX_SOURCE_IMAGE_BYTES } from '@/lib/media';

export function legacyImageHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function decodeLegacyImage(value: string): Buffer | null {
  if (value.length > Math.ceil(MAX_SOURCE_IMAGE_BYTES * 4 / 3) + 100) return null;
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  const buffer = Buffer.from(match[1], 'base64');
  return buffer.length > 0 && buffer.length <= MAX_SOURCE_IMAGE_BYTES ? buffer : null;
}

/**
 * Run before any public React/RSC boundary, not inside a client component.
 * Legacy blobs remain in storage until an operator runs the reviewed backfill.
 */
export function publicMediaContent<T>(value: T, slug: string): T {
  let nodes = 0;
  let characters = 0;
  class ProjectionLimit extends Error {}
  function projectString(item: string): string {
    if (/^data:/i.test(item)) {
      return decodeLegacyImage(item)
        ? `/api/public/image?${new URLSearchParams({ business: slug, asset: legacyImageHash(item) })}`
        : '';
    }
    return item.slice(0, 8000);
  }
  function visit(item: unknown, depth: number): unknown {
    if (++nodes > 4000 || depth > 12) throw new ProjectionLimit();
    if (typeof item === 'string') {
      const projected = projectString(item);
      characters += projected.length;
      if (characters > 64_000) throw new ProjectionLimit();
      return projected;
    }
    if (item instanceof Date) return item;
    if (Array.isArray(item)) return item.slice(0, 80).map((v) => visit(v, depth + 1));
    if (item && typeof item === 'object') {
      return Object.fromEntries(Object.entries(item).slice(0, 80).map(([key, v]) => [key.slice(0, 160), visit(v, depth + 1)]));
    }
    return item;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (key !== 'landingContent') return [key, typeof item === 'string' ? projectString(item) : item];
    try {
      return [key, visit(item, 0)];
    } catch (error) {
      if (!(error instanceof ProjectionLimit)) throw error;
      console.warn(JSON.stringify({ event: 'public_media_content_limited', slug }));
      // Only optional, untrusted landing JSON is dropped; relational fields retain their contracts.
      return [key, {}];
    }
  })) as T;
}

export function findLegacyImage(value: unknown, hash: string, depth = 0): Buffer | null {
  if (depth > 12) return null;
  if (typeof value === 'string') {
    return value.startsWith('data:image/') && legacyImageHash(value) === hash
      ? decodeLegacyImage(value) : null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const child of Object.values(value)) {
    const found = findLegacyImage(child, hash, depth + 1);
    if (found) return found;
  }
  return null;
}
