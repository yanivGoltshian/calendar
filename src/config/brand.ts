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
