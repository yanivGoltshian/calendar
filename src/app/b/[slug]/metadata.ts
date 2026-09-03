import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';

/**
 * קלט טהור לבניית מטא-דאטה של עמוד עסק — תת-קבוצה של שדות העסק
 * (שם, slug, תיאור) כדי שהפונקציה תהיה בדיקה-ביחידה ללא תלות ב-Prisma/DB.
 */
export type BusinessPageMetadataInput = {
  name: string;
  slug: string;
  description?: string | null;
  // דגל התצוגה המאוחד. כאשר listed=false → העמוד מקבל noindex,follow=false
  // (מוסתר מהאינדוקס יחד עם הסתרתו מהרשימה וממפת האתר). undefined/true → אינדוקס רגיל.
  listed?: boolean | null;
};

/**
 * בונה את ה-Metadata של עמוד העסק הציבורי /b/[slug].
 *
 * קריטי לתיקון הבאג: מעבירים image:null כדי ש-buildMetadata ישמיט את תגיות
 * openGraph/twitter images. כך Next משתמש בקובץ ה-file-convention
 * opengraph-image.tsx (הלוגו של העסק) במקום בכרטיס הפלטפורמה. אילו היינו
 * קובעים openGraph.images במפורש, זה היה דורס את ה-opengraph-image ומחזיר
 * את הבאג (לוגו הפלטפורמה בשיתופי וואטסאפ/רשתות).
 *
 * כשאין עסק — מחזירים כותרת ניטרלית בלבד (ללא canonical/תמונה).
 */
export function buildBusinessPageMetadata(
  business: BusinessPageMetadataInput | null,
): Metadata {
  if (!business) return { title: 'עסק' };

  return buildMetadata({
    title: business.name,
    description:
      business.description?.slice(0, 160) ??
      `קביעת תור אונליין אצל ${business.name}. בחירת שירות, בחירת מועד ואישור מיידי.`,
    path: `/b/${business.slug}`,
    image: null,
    // עסק שאינו מוצג (listed=false) — noindex,nofollow; אחרת אינדוקס רגיל.
    noIndex: business.listed === false,
  });
}
