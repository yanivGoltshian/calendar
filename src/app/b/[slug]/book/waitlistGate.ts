/**
 * לוגיקה טהורה (ללא React) עבור גייטינג רשימת ההמתנה בעמוד ההזמנה של הלקוח:
 * האם להציג את אזור ההצטרפות לרשימת ההמתנה, לפי הדגל הפר-עסקי
 * BusinessSettings.waitlistEnabled.
 *
 * מופרד לקובץ נפרד כדי שניתן יהיה לבדוק אותו ישירות ב-node test runner בלי לטעון
 * את רכיבי ה-React של עמוד ההזמנה.
 */

/**
 * אזור ההצטרפות לרשימת ההמתנה מוצג רק כאשר בעל העסק אפשר את רשימת ההמתנה.
 * ברירת המחדל (undefined) נחשבת כמופעלת כדי לשמור על תאימות-לאחור לעסקים קיימים.
 */
export function shouldShowWaitlist(waitlistEnabled: boolean | undefined): boolean {
  return waitlistEnabled !== false;
}
