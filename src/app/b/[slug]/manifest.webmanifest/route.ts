import { notFound } from 'next/navigation';
import { getBusinessBranding } from '@/server/repos/business';
import { resolveBrandColor, resolveBackgroundColor } from '@/lib/brandColor';

/**
 * מניפסט PWA דינמי לכל עסק.
 * מחזיר application/manifest+json עם שם, צבע וטווח (scope) של אותו עסק,
 * כך שכל עסק מקבל אפליקציה ניתנת-להתקנה ממותגת משלו.
 * מחזיר 404 כשהעסק לא קיים.
 */
export const runtime = 'nodejs';

type Props = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Props) {
  const { slug } = await params;
  const business = await getBusinessBranding(slug);
  if (!business) notFound();

  const base = `/b/${business.slug}`;
  const theme = resolveBrandColor(business.brandColor);
  const background = resolveBackgroundColor();

  const manifest = {
    name: business.name,
    short_name: business.name.slice(0, 12),
    description: `קביעת תור אונליין אצל ${business.name}`,
    start_url: base,
    scope: base,
    display: 'standalone',
    background_color: background,
    theme_color: theme,
    dir: 'rtl',
    lang: 'he',
    orientation: 'portrait',
    icons: [
      {
        src: `${base}/icon?size=192`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${base}/icon?size=512`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${base}/icon?size=512&maskable=1`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
