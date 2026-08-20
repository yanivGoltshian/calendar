/**
 * לוגיקה טהורה וניתנת לבדיקה עבור רמז גילוי תפריט הניהול (coach-mark).
 * הרמז מוצג פעם אחת בלבד אי פעם, ולכן די בדגל גלובלי יחיד ב-localStorage.
 * הרמז מתייחס לממשק (כפתור ההמבורגר / סרגל הצד) ולא לעסק מסוים,
 * ולכן אין צורך במזהה עסק ואין צורך בשום שינוי בצד השרת.
 */

/** מפתח גלובלי יחיד שמסמן שהרמז כבר נצפה. */
export const MENU_HINT_STORAGE_KEY = 'torchick_menu_hint_seen';

/** ממשק מינימלי שמאפשר להזריק אחסון מזויף בבדיקות. */
type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/**
 * האם להציג את הרמז? מציגים רק כאשר הדגל עדיין אינו קיים באחסון.
 * עמיד בפני חוסר אחסון (SSR / מצב פרטי) — במקרה כזה לא מציגים.
 */
export function shouldShowMenuHint(storage: ReadableStorage | null | undefined): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(MENU_HINT_STORAGE_KEY) === null;
  } catch {
    // גישה לאחסון עלולה להיכשל (למשל מדיניות פרטיות). מתגוננים בשקט.
    return false;
  }
}

/**
 * סימון הרמז כנצפה כדי שלא יופיע שוב לעולם. עמיד בפני כשלי אחסון.
 */
export function markMenuHintSeen(storage: WritableStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.setItem(MENU_HINT_STORAGE_KEY, '1');
  } catch {
    // אם לא ניתן לכתוב, הרמז פשוט יופיע שוב בביקור הבא. לא קריטי.
  }
}
