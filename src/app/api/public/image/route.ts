import { prisma } from '@/lib/db';
import { IMAGE_WIDTHS, MEDIA_CACHE_CONTROL } from '@/lib/media';
import { findLegacyImage } from '@/server/media/publicContent';
import { readSafeImage } from '@/server/media/safeFetch';
import { optimizeImage } from '@/server/media/image';
import { cachedImage } from '@/server/media/cache';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const width = Number(query.get('w') ?? 960);
  const keys = [...query.keys()];
  const slug = query.get('business');
  const hash = query.get('asset');
  const src = query.get('src');
  if (!(IMAGE_WIDTHS as readonly number[]).includes(width)) return new Response(null, { status: 400 });
  if (new Set(keys).size !== keys.length || keys.some((key) => !['w', 'business', 'asset', 'src'].includes(key))) return new Response(null, { status: 400 });
  if (src ? (src.length > 2048 || !!slug || !!hash) : (!slug || slug.length > 128 || !hash || !/^[a-f0-9]{64}$/.test(hash))) {
    return new Response(null, { status: 400 });
  }
  try {
    query.set('w', String(width));
    query.sort();
    const output = await cachedImage(query.toString(), async () => {
      let input: Buffer | null = null;
      if (slug && hash) {
        const business = await prisma.business.findFirst({
          where: { slug, accountStatus: 'ACTIVE' },
          select: { logoUrl: true, coverImageUrl: true, landingContent: true, staff: { where: { active: true }, select: { avatarUrl: true } } },
        });
        input = findLegacyImage(business, hash);
      } else if (src) {
        input = await readSafeImage(src);
      }
      if (!input) throw new Error('image_missing');
      return optimizeImage(input, width);
    });
    return new Response(new Uint8Array(output), { headers: {
      'content-type': 'image/webp',
      'content-length': String(output.length),
      'cache-control': MEDIA_CACHE_CONTROL,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    } });
  } catch (error) {
    return new Response(null, { status: error instanceof Error && error.message === 'image_busy' ? 503 : 404, headers: { 'cache-control': 'no-store' } });
  }
}
