import { lookup } from 'node:dns/promises';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { Agent, type Dispatcher } from 'undici';

export type BusinessImportFetch = (
  input: string | URL | Request,
  init?: RequestInit & { dispatcher?: Dispatcher },
) => Promise<Response>;

export type BusinessImportResolver = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

export interface BusinessImportNetworkOptions {
  resolveHostname?: BusinessImportResolver;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
}

export interface ImportedHtmlPage {
  requestedUrl: string;
  finalUrl: string;
  html: string;
}

export interface ImportedPublicImage {
  requestedUrl: string;
  finalUrl: string;
  contentType: string;
  bytes: Buffer;
}

export type BusinessImportErrorCode =
  | 'invalid_url'
  | 'blocked_hostname'
  | 'blocked_address'
  | 'dns_failed'
  | 'timeout'
  | 'redirect_limit'
  | 'redirect_location'
  | 'http_status'
  | 'content_type'
  | 'response_too_large'
  | 'network_error';

export interface BusinessImportDiagnostics {
  stage: 'dns' | 'connect' | 'response';
  resolvedAddressCount?: number;
  resolvedAddressFamilies?: number[];
  transportCode?: string;
}

export class BusinessImportError extends Error {
  constructor(
    readonly code: BusinessImportErrorCode,
    message: string,
    readonly url?: string,
    readonly status?: number,
    readonly diagnostics?: BusinessImportDiagnostics,
  ) {
    super(message);
    this.name = 'BusinessImportError';
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

const blockedIpv4Addresses = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, 'ipv4');
}
blockedIpv4Addresses.addAddress('168.63.129.16', 'ipv4');

const blockedIpv6Addresses = new BlockList();
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32],
  ['2001:2::', 48],
  ['2001:10::', 28],
  ['2001:20::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, 'ipv6');
}

function normalizedHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizedHostname(hostname);
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized === 'metadata.google.internal' ||
    normalized === 'metadata.azure.internal' ||
    normalized === 'instance-data' ||
    normalized === 'kubernetes.default' ||
    normalized.endsWith('.home.arpa')
  );
}

export function isPublicNetworkAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedIpv4Addresses.check(address, 'ipv4');
  if (family === 6) return !blockedIpv6Addresses.check(address, 'ipv6');
  return false;
}

export function parsePublicHttpUrl(value: string | URL): URL {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value.href) : new URL(value);
  } catch {
    throw new BusinessImportError('invalid_url', 'The source must be a valid URL.');
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.href.length > 4_096
  ) {
    throw new BusinessImportError(
      'invalid_url',
      'Only credential-free HTTP and HTTPS URLs are supported.',
      url.href,
    );
  }
  if (isBlockedHostname(url.hostname)) {
    throw new BusinessImportError(
      'blocked_hostname',
      'The hostname is not public.',
      url.href,
    );
  }
  return url;
}

async function resolvePublicAddresses(
  url: URL,
  resolver: BusinessImportResolver,
  timeoutMs: number,
): Promise<Array<{ address: string; family: number }>> {
  const hostname = normalizedHostname(url.hostname);
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await withTimeout(
        resolver(hostname),
        timeoutMs,
        () => new BusinessImportError('timeout', 'DNS resolution timed out.', url.href),
      ).catch((error: unknown) => {
        if (error instanceof BusinessImportError) throw error;
        throw new BusinessImportError('dns_failed', 'DNS resolution failed.', url.href);
      });

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicNetworkAddress(address))
  ) {
    throw new BusinessImportError(
      'blocked_address',
      'The hostname resolves to a non-public network address.',
      url.href,
    );
  }
  return addresses;
}

export function createPinnedLookup(
  addresses: Array<{ address: string; family: number }>,
): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, addresses);
      return;
    }
    const requestedFamily =
      options.family === 4 || options.family === 6 ? options.family : undefined;
    const selected =
      addresses.find(({ family }) => family === requestedFamily) ?? addresses[0];
    if (!selected) {
      callback(
        Object.assign(new Error('No validated address is available.'), {
          code: 'ENOTFOUND',
        }),
        [],
      );
      return;
    }
    callback(null, selected.address, selected.family);
  };
}

function safeTransportCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== 'object') return undefined;
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: () => Error,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(timeoutError()), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isRedirect(status: number): boolean {
  return (
    status === 301 || status === 302 || status === 303 || status === 307 || status === 308
  );
}

async function readLimitedText(
  response: Response,
  maxResponseBytes: number,
  url: URL,
): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    await response.body?.cancel();
    throw new BusinessImportError(
      'response_too_large',
      `The response exceeds ${maxResponseBytes} bytes.`,
      url.href,
      response.status,
    );
  }

  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw new BusinessImportError(
          'response_too_large',
          `The response exceeds ${maxResponseBytes} bytes.`,
          url.href,
          response.status,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(
    Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
  );
}

async function readLimitedBytes(
  response: Response,
  maxResponseBytes: number,
  url: URL,
): Promise<Buffer> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    await response.body?.cancel();
    throw new BusinessImportError(
      'response_too_large',
      `The response exceeds ${maxResponseBytes} bytes.`,
      url.href,
      response.status,
    );
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw new BusinessImportError(
          'response_too_large',
          `The response exceeds ${maxResponseBytes} bytes.`,
          url.href,
          response.status,
        );
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function fetchPublicHtml(
  input: string | URL,
  fetchImpl: BusinessImportFetch,
  options: BusinessImportNetworkOptions = {},
  allowedOrigin?: string,
): Promise<ImportedHtmlPage> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const resolver =
    options.resolveHostname ??
    ((hostname: string) => lookup(hostname, { all: true, verbatim: true }));

  let current = parsePublicHttpUrl(input);
  const requestedUrl = current.href;

  for (let redirectCount = 0; ; redirectCount += 1) {
    if (allowedOrigin && current.origin !== allowedOrigin) {
      throw new BusinessImportError(
        'blocked_hostname',
        'Discovered pages must remain on the source origin.',
        current.href,
      );
    }
    const addresses = await resolvePublicAddresses(current, resolver, timeoutMs);
    const dispatcher = new Agent({
      connect: {
        lookup: createPinnedLookup(addresses),
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 250,
      },
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(current, {
        redirect: 'manual',
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        dispatcher,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9',
          'User-Agent': 'TorChickBusinessImporter/1.0 (+public-metadata-only)',
        },
      });

      if (isRedirect(response.status)) {
        await response.body?.cancel();
        if (redirectCount >= maxRedirects) {
          throw new BusinessImportError(
            'redirect_limit',
            `The response exceeded ${maxRedirects} redirects.`,
            current.href,
            response.status,
          );
        }
        const location = response.headers.get('location');
        if (!location) {
          throw new BusinessImportError(
            'redirect_location',
            'The redirect response did not include a location.',
            current.href,
            response.status,
          );
        }
        current = parsePublicHttpUrl(new URL(location, current));
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new BusinessImportError(
          'http_status',
          `The source returned HTTP ${response.status}.`,
          current.href,
          response.status,
        );
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (
        !contentType.startsWith('text/html') &&
        !contentType.startsWith('application/xhtml+xml')
      ) {
        await response.body?.cancel();
        throw new BusinessImportError(
          'content_type',
          `Unsupported content type: ${contentType || 'missing'}.`,
          current.href,
          response.status,
        );
      }

      return {
        requestedUrl,
        finalUrl: current.href,
        html: await readLimitedText(response, maxResponseBytes, current),
      };
    } catch (error) {
      if (error instanceof BusinessImportError) throw error;
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw new BusinessImportError(
          'timeout',
          'The request timed out.',
          current.href,
          undefined,
          {
            stage: 'response',
            resolvedAddressCount: addresses.length,
            resolvedAddressFamilies: [...new Set(addresses.map(({ family }) => family))],
            transportCode: safeTransportCode(error),
          },
        );
      }
      throw new BusinessImportError(
        'network_error',
        'The request failed.',
        current.href,
        undefined,
        {
          stage: 'connect',
          resolvedAddressCount: addresses.length,
          resolvedAddressFamilies: [...new Set(addresses.map(({ family }) => family))],
          transportCode: safeTransportCode(error),
        },
      );
    } finally {
      clearTimeout(timer);
      await dispatcher.close();
    }
  }
}

/**
 * Downloads one public image through the same DNS-pinned SSRF boundary as HTML.
 * The caller is responsible for decoding and re-encoding the bytes before storage.
 */
export async function fetchPublicImage(
  input: string | URL,
  fetchImpl: BusinessImportFetch,
  options: BusinessImportNetworkOptions = {},
): Promise<ImportedPublicImage> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const resolver =
    options.resolveHostname ??
    ((hostname: string) => lookup(hostname, { all: true, verbatim: true }));

  let current = parsePublicHttpUrl(input);
  const requestedUrl = current.href;

  for (let redirectCount = 0; ; redirectCount += 1) {
    const addresses = await resolvePublicAddresses(current, resolver, timeoutMs);
    const dispatcher = new Agent({
      connect: {
        lookup: createPinnedLookup(addresses),
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 250,
      },
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(current, {
        redirect: 'manual',
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        dispatcher,
        headers: {
          Accept: 'image/webp,image/png,image/jpeg',
          'User-Agent': 'TorChickBusinessImporter/1.0 (+public-image-copy)',
        },
      });

      if (isRedirect(response.status)) {
        await response.body?.cancel();
        if (redirectCount >= maxRedirects) {
          throw new BusinessImportError(
            'redirect_limit',
            `The response exceeded ${maxRedirects} redirects.`,
            current.href,
            response.status,
          );
        }
        const location = response.headers.get('location');
        if (!location) {
          throw new BusinessImportError(
            'redirect_location',
            'The redirect response did not include a location.',
            current.href,
            response.status,
          );
        }
        current = parsePublicHttpUrl(new URL(location, current));
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        throw new BusinessImportError(
          'http_status',
          `The source returned HTTP ${response.status}.`,
          current.href,
          response.status,
        );
      }

      const contentType =
        response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ??
        '';
      if (!['image/webp', 'image/png', 'image/jpeg'].includes(contentType)) {
        await response.body?.cancel();
        throw new BusinessImportError(
          'content_type',
          `Unsupported content type: ${contentType || 'missing'}.`,
          current.href,
          response.status,
        );
      }

      return {
        requestedUrl,
        finalUrl: current.href,
        contentType,
        bytes: await readLimitedBytes(response, maxResponseBytes, current),
      };
    } catch (error) {
      if (error instanceof BusinessImportError) throw error;
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw new BusinessImportError('timeout', 'The request timed out.', current.href);
      }
      throw new BusinessImportError('network_error', 'The request failed.', current.href);
    } finally {
      clearTimeout(timer);
      await dispatcher.close();
    }
  }
}
