/**
 * לוגיקה טהורה לספריית העסקים הציבורית (/businesses).
 *
 * מרוכזת כאן כדי להיות ניתנת לבדיקה ללא DB וללא React:
 *  - שער הקישור בניווט/כותרת תחתונה: הקישור מופיע רק כשמספר העסקים המוצגים ≥ 3.
 *  - הפרדיקט/מסנן של "מוצג לציבור" (listed=true ולא ממתין למחיקה) — אותה כוונה
 *    שמופיעה גם בשאילתות ה-Prisma, מתועדת ובדוקה במקום אחד.
 */

/** סף העסקים המוצגים שמעליו (כולל) מוצג הקישור לספרייה בניווט. */
export const DIRECTORY_MIN_LISTED = 3;

/**
 * שער הקישור: האם להציג את הקישור ל-/businesses.
 * מחזיר true רק כאשר הספירה סופית וגדולה-או-שווה לסף (3). כל ערך לא-תקין
 * (NaN/שלילי/לא מספר) מחזיר false, כך שהשער "נכשל סגור" ואינו חושף קישור בטעות.
 */
export function shouldShowDirectoryLink(count: number): boolean {
  return Number.isFinite(count) && count >= DIRECTORY_MIN_LISTED;
}

/** צורת שדות המינימום להכרעת "מוצג לציבור". */
export type PublicListable = {
  listed?: boolean | null;
  accountStatus?: string | null;
};

/**
 * פרדיקט טהור: האם עסק מוצג לציבור (ברשימה, במפה ולאינדוקס).
 * דורש listed=true במפורש וגם שאינו ממתין למחיקה (PENDING_DELETION).
 */
export function isPubliclyListed(business: PublicListable): boolean {
  return business.listed === true && business.accountStatus !== 'PENDING_DELETION';
}

/** מסנן רשימת עסקים למוצגים-לציבור בלבד — שימושי לבדיקות ולסינון בזיכרון. */
export function filterPubliclyListed<T extends PublicListable>(list: readonly T[]): T[] {
  return list.filter(isPubliclyListed);
}
