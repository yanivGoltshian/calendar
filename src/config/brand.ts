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
 * סלאג עסק ההדגמה השיווקי הקנוני, קליניקת סקין ביוטי בפרימיום.
 * העסק נזרע בפרודקשן ב-prisma/seed.ts וכל נקודות הכניסה הציבוריות נגזרות ממנו.
 */
export const DEMO_BUSINESS_SLUG = 'skin-beauty';

/** כתובת עמוד ההדגמה השיווקי. אין לשכפל את הנתיב ברכיבים ציבוריים. */
export const DEMO_BUSINESS_PATH = `/b/${DEMO_BUSINESS_SLUG}` as const;
