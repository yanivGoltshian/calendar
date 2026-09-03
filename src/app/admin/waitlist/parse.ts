/**
 * ניתוח טהור (ללא React / ללא 'use server') של ערך הטוגל להפעלת רשימת ההמתנה
 * מתוך טופס עמוד הניהול. מופרד מ-actions.ts כדי שניתן יהיה לבדוק אותו ישירות
 * ב-node test runner בלי לטעון את שכבת השרת (Prisma / next/cache).
 *
 * חוזה הטופס: הטוגל שולח את שדה `enabled` עם הערך היעד. נוכחות אחת מהערכים
 * 'on' / 'true' / '1' (ללא תלות ברישיות) ⇐ true; כל ערך אחר או היעדר שדה ⇐ false.
 */
export function parseWaitlistEnabled(formData: FormData): boolean {
  const raw = formData.get('enabled');
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return value === 'on' || value === 'true' || value === '1';
}
