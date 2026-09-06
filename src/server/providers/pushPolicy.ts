import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request, type RequestOptions } from 'node:https';
import type { RequestDetails } from 'web-push';
import { isPublicAddress } from '@/server/media/safeFetch';

const PUSH_HOSTS = new Set([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

/** Browser vendors only. WNS assigns subscriptions to regional service-owned hosts. */
export function permittedPushEndpoint(value: string): URL | null {
  if (value.length > 4096 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
        (url.port && url.port !== '443')) return null;
    if (!PUSH_HOSTS.has(url.hostname) && !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.notify\.windows\.com$/.test(url.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export type PushTransportDependencies = {
  resolve?: (hostname: string) => Promise<{ address: string; family: number }[]>;
  request?: typeof request;
};

export class PushResponseError extends Error {
  constructor(readonly statusCode: number) {
    super(`Push service returned status ${statusCode}`);
  }
}

/** web-push supplies encryption/VAPID only; this transport never follows redirects or re-resolves DNS. */
export async function sendPinnedPush(
  details: Pick<RequestDetails, 'endpoint' | 'headers' | 'body'>,
  dependencies: PushTransportDependencies = {},
): Promise<void> {
  const url = permittedPushEndpoint(details.endpoint);
  if (!url) throw new Error('push_origin');
  const deadline = AbortSignal.timeout(8000);
  let onTimeout: (() => void) | undefined;
  let addresses: { address: string; family: number }[];
  try {
    addresses = await Promise.race([
      dependencies.resolve ? dependencies.resolve(url.hostname) : lookup(url.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        onTimeout = () => reject(new Error('push_timeout'));
        deadline.addEventListener('abort', onTimeout, { once: true });
      }),
    ]);
  } finally {
    if (onTimeout) deadline.removeEventListener('abort', onTimeout);
  }
  if (!addresses.length || addresses.some(({ address, family }) =>
    !isPublicAddress(address) || isIP(address) !== family)) throw new Error('push_address');
  const pinned = addresses[0];
  return new Promise<void>((resolve, reject) => {
    const options: RequestOptions = {
      // Connecting to the literal checked IP bypasses DNS entirely; retain the
      // vendor hostname for SNI, certificate verification and the HTTP Host header.
      hostname: pinned.address, family: pinned.family, port: 443,
      servername: url.hostname, rejectUnauthorized: true, agent: false,
      path: `${url.pathname}${url.search}`, method: 'POST',
      headers: { ...details.headers, Host: url.host }, signal: deadline,
    };
    const req = (dependencies.request ?? request)(options, (res) => {
      const status = res.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        res.destroy();
        reject(new PushResponseError(status));
        return;
      }
      let responseBytes = 0;
      res.on('data', (chunk: Buffer) => {
        responseBytes += chunk.length;
        if (responseBytes > 4096) res.destroy(new Error('push_response_size'));
      });
      res.on('error', reject);
      res.on('aborted', () => reject(new Error('push_response_aborted')));
      res.on('end', resolve);
    });
    req.on('error', reject);
    if (details.body) req.end(details.body);
    else req.end();
  });
}
