/**
 * מותג המוצר — מרוכז כאן בלבד.
 *
 * יש להשתמש ב-BRAND.name בכל מקום (כותרות דפים, כותרת עליונה,
 * manifest של ה-PWA, מיילים וכו') ולא להטמיע את השם ידנית.
 */
export const BRAND = {
  /** שם המותג להצגה (עברית) */
  name: 'תור צ׳יק',
  /** מזהה לטיני למטא-דאטה, קבצים וקוד */
  latinName: 'Torchick',
  /** סלוגן קצר */
  tagline: 'להזמין תור בצ׳יק',
  /** דומיין ראשי */
  domain: 'torchick.com',
  /** צבע המותג הראשי — נייבי (משמש גם ב-PWA manifest וב-theme-color) */
  themeColor: '#0A182D',
  backgroundColor: '#FAF8F5',
} as const;

export type Brand = typeof BRAND;

/**
 * סלאג עסק ההדגמה הקנוני, שנזרע תמיד בפרודקשן (ראו prisma/seed.ts).
 *
 * משמש כ-fallback יציב ל-gate של קישור ההדגמה בדף הבית הסטטי: בזמן build אין
 * DATABASE_URL, ולכן getFirstBusiness() נכשל ומחזיר null — בלי ה-fallback הזה
 * ה-gate מתאפס וקישורי ההדגמה נושרים מה-HTML הסטטי הנאפה. הערך משמש אך ורק
 * כ-gate בוליאני (truthy) ולעולם לא לבניית ה-href, שמפנה תמיד לבוחר הסטטי /demo.
 */
export const DEMO_BUSINESS_SLUG = 'demo-barbershop';
