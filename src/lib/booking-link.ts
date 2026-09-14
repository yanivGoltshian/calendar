import { absoluteUrl } from '@/lib/seo';

/**
 * עוזרים טהורים לבניית קישור ההזמנות הציבורי של עסק ולזיהוי מצב "חי".
 * ללא תלות בבסיס נתונים, כדי שיהיו ניתנים לבדיקה ולשימוש חוזר בשרת ובלקוח.
 */

/** הנתיב היחסי לעמוד ההזמנות הציבורי של העסק. */
export function bookingPath(slug: string): string {
  return `/b/${slug}`;
}

/** כתובת מוחלטת לעמוד ההזמנות, בנויה על עוזר בסיס הכתובת המשותף. */
export function bookingUrl(slug: string): string {
  return absoluteUrl(bookingPath(slug));
}

export type BusinessShareDestination = 'business' | 'booking';

function shareAssetVersion(logoUrl?: string | null): string {
  const value = logoUrl?.trim();
  if (!value) return 'logo-only-v1-text';
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `logo-only-v1-${(hash >>> 0).toString(36)}`;
}

export function withBusinessShareVersion(
  pathOrUrl: string,
  logoUrl?: string | null,
): string {
  const absolute = /^https?:\/\//i.test(pathOrUrl);
  const url = new URL(pathOrUrl, 'https://share.invalid');
  url.searchParams.set('share', shareAssetVersion(logoUrl));
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

/**
 * In-app sharing uses a deterministic cache key tied to the logo-only contract
 * and saved logo identity. The canonical SEO URL remains unchanged.
 */
export function businessSharePath(
  slug: string,
  logoUrl?: string | null,
  destination: BusinessShareDestination = 'business',
): string {
  const path = destination === 'booking' ? `${bookingPath(slug)}/book` : bookingPath(slug);
  return withBusinessShareVersion(path, logoUrl);
}

export function businessShareUrl(
  slug: string,
  logoUrl?: string | null,
  destination: BusinessShareDestination = 'business',
): string {
  return absoluteUrl(businessSharePath(slug, logoUrl, destination));
}

/**
 * שער "העסק חי": המינימום לקבלת הזמנות הוא לפחות שירות אחד ושעות פעילות מוגדרות.
 * מסתמך על אותם אותות השלמה שכבר מחושבים לרשימת ההקמה.
 */
export function isBusinessLive(input: {
  serviceCount: number;
  workingHoursCount: number;
}): boolean {
  return input.serviceCount > 0 && input.workingHoursCount > 0;
}
