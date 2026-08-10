/**
 * מותג המוצר — מרוכז כאן בלבד.
 *
 * שם המוצר הסופי נקבע בנפרד. אין להטמיע שם קבוע בקוד; יש להשתמש ב-BRAND.name
 * בכל מקום (כותרות דפים, כותרת עליונה, manifest של ה-PWA, מיילים וכו').
 * החלפת השם בעתיד = שינוי שורה אחת כאן.
 */
export const BRAND = {
  /** שם זמני (placeholder) — יוחלף כשייקבע השם הסופי */
  name: 'Booqi',
  /** תיאור קצר / סלוגן — ריק בינתיים */
  tagline: '',
  /** צבע המותג הראשי (משמש גם ב-PWA manifest וב-theme-color) */
  themeColor: '#7a37e0',
  backgroundColor: '#ffffff',
} as const;

export type Brand = typeof BRAND;
