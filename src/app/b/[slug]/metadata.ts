import type { Metadata } from 'next';
import { absoluteUrl, buildMetadata } from '@/lib/seo';
import { isPubliclyListed, type PublicListable } from '@/lib/directory';

/**
 * קלט טהור לבניית מטא-דאטה של עמוד עסק — תת-קבוצה של שדות העסק
 * (שם, slug, תיאור) כדי שהפונקציה תהיה בדיקה-ביחידה ללא תלות ב-Prisma/DB.
 */
export type BusinessPageMetadataInput = PublicListable & {
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
};

/**
 * Use the saved logo directly, including the public projection of legacy uploads.
 * Without a logo, share text only rather than inventing a business image.
 */
export function buildBusinessPageMetadata(
  business: BusinessPageMetadataInput | null,
): Metadata {
  if (!business) return { title: 'עסק' };

  const logo = business.logoUrl?.trim();
  const image = logo?.startsWith('/') && !logo.startsWith('//')
    ? absoluteUrl(logo)
    : logo && /^https?:\/\//i.test(logo) ? logo : null;
  const metadata = buildMetadata({
    title: business.name,
    description:
      business.description?.slice(0, 160) ??
      `קביעת תור אונליין אצל ${business.name}. בחירת שירות, בחירת מועד ואישור מיידי.`,
    path: `/b/${business.slug}`,
    image,
    noIndex: !isPubliclyListed(business),
  });
  return {
    ...metadata,
    twitter: { ...metadata.twitter, card: 'summary' },
  };
}
