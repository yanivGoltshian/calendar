export const IMAGE_WIDTHS = [320, 640, 960, 1600] as const;
export const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_RENDERED_IMAGE_BYTES = 250 * 1024;
export const MEDIA_CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';

export function imageUrl(src: string, width = 960): string {
  const bounded = IMAGE_WIDTHS.find((w) => w >= width) ?? 1600;
  if (src.startsWith('/api/public/image?')) {
    const query = new URLSearchParams(src.split('?')[1]);
    query.set('w', String(bounded));
    return `/api/public/image?${query}`;
  }
  return `/api/public/image?${new URLSearchParams({ src, w: String(bounded) })}`;
}
