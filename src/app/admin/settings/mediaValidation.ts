export const MAX_LANDING_CONTENT_BYTES = 32 * 1024;
const MAX_MEDIA_URL_BYTES = 2048;
const MAX_TEXT_BYTES = 4096;

type MediaProfile = {
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  landingContent?: unknown;
};

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function isDataUrl(value: string): boolean {
  return /^data:/i.test(value.trim());
}

export function isSafeMediaUrl(value: string | null | undefined, previous?: unknown): boolean {
  if (!value) return true;
  if (value === previous) return true;
  if (isDataUrl(value)) return value === previous;
  if (byteLength(value) > MAX_MEDIA_URL_BYTES || value.includes('\\')) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Call before JSON.parse; legacy image payloads may survive, but cannot grow without bound. */
export function isLandingDraftSizeAllowed(raw: string, previous: unknown): boolean {
  return byteLength(raw) <= MAX_LANDING_CONTENT_BYTES + byteLength(JSON.stringify(previous ?? null));
}

/** Exact-path legacy data URLs are read-only exceptions, not reusable upload tokens. */
export function isSafeBusinessMediaWrite(next: MediaProfile, previous: MediaProfile): boolean {
  if (!isSafeMediaUrl(next.logoUrl, previous.logoUrl) ||
      !isSafeMediaUrl(next.coverImageUrl, previous.coverImageUrl)) return false;
  if (next.landingContent === undefined) return true;
  let nodes = 0;
  function bounded(value: unknown, old: unknown, field = '', depth = 0): unknown {
    if (++nodes > 512 || depth > 12) throw new Error('content_too_large');
    if (typeof value === 'string') {
      if (isDataUrl(value)) {
        if (value !== old) throw new Error('image_url');
        return ''; // Existing embedded images do not consume the new-content budget.
      }
      if (byteLength(value) > MAX_TEXT_BYTES) throw new Error('content_too_large');
      if ((/Urls?$/.test(field) || ['heroImages', 'images'].includes(field)) &&
          !isSafeMediaUrl(value, old)) throw new Error('image_url');
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((entry, index) => bounded(
        entry, Array.isArray(old) ? old[index] : undefined, field, depth + 1,
      ));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
        key, bounded(entry, old && typeof old === 'object'
          ? (old as Record<string, unknown>)[key] : undefined, key, depth + 1),
      ]));
    }
    return value;
  }
  try {
    return byteLength(JSON.stringify(bounded(next.landingContent, previous.landingContent))) <= MAX_LANDING_CONTENT_BYTES;
  } catch {
    return false;
  }
}
