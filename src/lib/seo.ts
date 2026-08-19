import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';

/**
 * תשתית SEO משותפת — כתובת בסיס, בונה מטא-דאטה ובוני JSON-LD.
 * נבנתה לשימוש חוזר: הפלטפורמה כעת, ועמודי העסקים /b/[slug] בהמשך.
 */

/** כתובת הבסיס הציבורית (לפי משתנה סביבה, עם נפילה לפיתוח מקומי). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');

/** ברירת מחדל לתיאור השיווקי של הפלטפורמה. */
export const SITE_DESCRIPTION =
  'תוכנת זימון תורים וניהול עסק לעסקי שירות בישראל. עמוד עסק אישי מעוצב, יומן חכם, תזכורות אוטומטיות וקביעת תורים אונליין 24/7.';

/** בניית כתובת מוחלטת מתוך נתיב יחסי. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** בניית כתובת לתמונת OG דינמית. */
export function ogImageUrl(params: { title?: string; subtitle?: string } = {}): string {
  const search = new URLSearchParams();
  if (params.title) search.set('title', params.title);
  if (params.subtitle) search.set('subtitle', params.subtitle);
  const qs = search.toString();
  return absoluteUrl(`/og${qs ? `?${qs}` : ''}`);
}

/**
 * נתיב כרטיס השיתוף הסטטי של הפלטפורמה (לוגו תור צ׳יק, 1200x630).
 * קובץ PNG קל (כ-62KB) המוגש מיידית, כדי שתצוגות הקישור יעבדו גם ב-WhatsApp
 * ובפייסבוק, שמוותרים על תמונת OG כשהיא כבדה או איטית מדי לטעינה.
 */
export const OG_CARD_PATH = '/brand/og-card.png';

/** כתובת מוחלטת לכרטיס השיתוף הסטטי של הפלטפורמה. */
export function ogCardUrl(): string {
  return absoluteUrl(OG_CARD_PATH);
}

type BuildMetadataOptions = {
  title?: string;
  description?: string;
  path?: string;
  ogTitle?: string;
  ogSubtitle?: string;
  ogLogo?: boolean;
  noIndex?: boolean;
};

/**
 * עוזר משותף לבניית Metadata לעמוד: כותרת, תיאור, canonical, Open Graph ו-Twitter.
 * מיושם על עמודים ציבוריים כדי לשמור על עקביות ואיכות SEO.
 */
export function buildMetadata(options: BuildMetadataOptions = {}): Metadata {
  const {
    title,
    description = SITE_DESCRIPTION,
    path = '/',
    ogTitle,
    ogSubtitle,
    ogLogo = false,
    noIndex = false,
  } = options;

  const canonical = absoluteUrl(path);
  const image = ogLogo
    ? ogCardUrl()
    : ogImageUrl({ title: ogTitle ?? title ?? BRAND.name, subtitle: ogSubtitle });
  const imageType = 'image/png';
  const resolvedTitle = title ?? BRAND.name;

  return {
    title,
    description,
    alternates: { canonical },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'he_IL',
      url: canonical,
      siteName: BRAND.name,
      title: resolvedTitle,
      description,
      images: [{ url: image, type: imageType, width: 1200, height: 630, alt: resolvedTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description,
      images: [image],
    },
  };
}

/** סכימת Organization לפלטפורמה עצמה. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    url: SITE_URL,
    logo: absoluteUrl('/icons/icon-192.png'),
    description: SITE_DESCRIPTION,
    sameAs: [] as string[],
  };
}

/** סכימת WebSite עם תיבת חיפוש פוטנציאלית. */
export function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND.name,
    url: SITE_URL,
    inLanguage: 'he-IL',
  };
}

export type LocalBusinessInput = {
  name: string;
  slug: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  image?: string | null;
  instagramUrl?: string | null;
  priceRange?: string;
  openingHours?: string[];
  geo?: { latitude: number; longitude: number } | null;
};

/**
 * בונה JSON-LD מסוג LocalBusiness — לשימוש חוזר בעמודי העסק /b/[slug].
 * כולל שם, כתובת, גאו, שעות פתיחה, טווח מחירים, טלפון ותמונה.
 */
export function localBusinessJsonLd(business: LocalBusinessInput) {
  const url = absoluteUrl(`/b/${business.slug}`);
  const sameAs = business.instagramUrl ? [business.instagramUrl] : [];

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    url,
    ...(business.description ? { description: business.description } : {}),
    ...(business.image ? { image: business.image } : {}),
    ...(business.phone ? { telephone: business.phone } : {}),
    ...(business.priceRange ? { priceRange: business.priceRange } : {}),
    ...(business.address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: business.address,
            addressCountry: 'IL',
          },
        }
      : {}),
    ...(business.geo
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: business.geo.latitude,
            longitude: business.geo.longitude,
          },
        }
      : {}),
    ...(business.openingHours && business.openingHours.length
      ? { openingHours: business.openingHours }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}
