/**
 * לוגיקת ההתאמה של רשימת ההמתנה — מודול טהור (ללא DB), כדי שיהיה נתון לבדיקה.
 *
 * כשמתפנה משבצת (תור שבוטל), אנו מחפשים את הממתינים ברשימה שמתאימים לאותה משבצת:
 * אותו שירות (אם צוין), אותו איש צוות (אם צוין ברשומת ההמתנה), אותו תאריך (אם צוין),
 * ושהמשבצת מתחילה בתוך חלון הזמן המבוקש (אם צוין). התוצאה מדורגת לפי ותק (first-come):
 * מי שנרשם קודם מקבל עדיפות.
 */

/** רשומת ממתין מצומצמת לשדות הדרושים להתאמה (תת-קבוצה של WaitlistEntry). */
export type WaitlistCandidate = {
  id: string;
  serviceId: string | null;
  staffId: string | null;
  desiredDate: string | null; // YYYY-MM-DD (מקומי)
  earliestMinute: number | null; // דקות מתחילת היום
  latestMinute: number | null;
  status: string; // WaitlistStatus — רק WAITING כשיר להתאמה אוטומטית
  createdAt: Date;
};

/** המשבצת שהתפנתה, גזורה מהתור שבוטל (זמנים מקומיים בדקות מתחילת היום). */
export type FreedSlot = {
  serviceIds: string[]; // מזהי השירותים שהיו על התור שבוטל
  staffId: string; // איש הצוות של התור
  dateStr: string; // YYYY-MM-DD (מקומי)
  startMinute: number; // דקת ההתחלה המקומית של המשבצת
  endMinute: number; // דקת הסיום המקומית
};

/**
 * האם ממתין בודד מתאים למשבצת שהתפנתה. כללי ההתאמה (כולם חייבים להתקיים):
 * 1. סטטוס WAITING בלבד — רשומה שכבר יודעה/הוזמנה/פגה אינה כשירה.
 * 2. שירות: לרשומה אין שירות מבוקש, או שהשירות המבוקש נכלל בשירותי התור שבוטל.
 * 3. איש צוות: לרשומה אין איש צוות מבוקש, או שהוא זהה לאיש הצוות של התור.
 * 4. תאריך: לרשומה אין תאריך מבוקש, או שהוא זהה לתאריך המשבצת.
 * 5. חלון שעה: המשבצת מתחילה בתוך [earliestMinute, latestMinute] (קצוות פתוחים אם null).
 */
export function matchesFreedSlot(entry: WaitlistCandidate, slot: FreedSlot): boolean {
  if (entry.status !== 'WAITING') return false;

  // שירות: אם צוין — חייב להיכלל בשירותי התור שהתפנה.
  if (entry.serviceId && !slot.serviceIds.includes(entry.serviceId)) {
    return false;
  }

  // איש צוות: מוחל רק כשהרשומה ביקשה איש צוות ספציפי.
  if (entry.staffId && entry.staffId !== slot.staffId) {
    return false;
  }

  // תאריך: מוחל רק כשהרשומה ביקשה תאריך ספציפי.
  if (entry.desiredDate && entry.desiredDate !== slot.dateStr) {
    return false;
  }

  // חלון שעה: המשבצת חייבת להתחיל בתוך הטווח המבוקש (קצה חסר = פתוח).
  if (entry.earliestMinute != null && slot.startMinute < entry.earliestMinute) {
    return false;
  }
  if (entry.latestMinute != null && slot.startMinute > entry.latestMinute) {
    return false;
  }

  return true;
}

/**
 * דירוג הממתינים המתאימים למשבצת, לפי ותק (first-come-first-served): מי שנרשם
 * מוקדם יותר מקבל עדיפות. שובר שוויון יציב לפי id כדי שהסדר יהיה דטרמיניסטי.
 * הרשומות שאינן מתאימות מסוננות החוצה.
 */
export function rankWaitlistMatches(
  entries: WaitlistCandidate[],
  slot: FreedSlot,
): WaitlistCandidate[] {
  return entries
    .filter((e) => matchesFreedSlot(e, slot))
    .sort((a, b) => {
      const diff = a.createdAt.getTime() - b.createdAt.getTime();
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
