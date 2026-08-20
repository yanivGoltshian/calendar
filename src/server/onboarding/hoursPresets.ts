import type { WorkingHoursRow } from '@/server/repos/workingHours';

/**
 * תבניות שעות פעילות בלחיצה אחת עבור אשף ההקמה.
 * עוזר טהור (ללא תלות בבסיס נתונים) כדי שיהיה ניתן לבדיקה ולשימוש חוזר.
 * הבעלים תמיד יכול לכוונן ידנית אחר כך במסך שעות הפעילות.
 */

export type HoursPresetKey = 'sun-thu' | 'every-day' | 'custom';

/** בונה שורות שעות זהות עבור רשימת ימי שבוע נתונה (0=ראשון .. 6=שבת). */
function rows(weekdays: number[], startMinute: number, endMinute: number): WorkingHoursRow[] {
  return weekdays.map((weekday) => ({ weekday, startMinute, endMinute, breaks: [] }));
}

const SUN_THU = [0, 1, 2, 3, 4];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/**
 * ממפה מפתח תבנית לשורות שעות מוכנות ל-setBusinessHours:
 * - 'sun-thu'   → ראשון–חמישי, 09:00–18:00
 * - 'every-day' → כל השבוע, 09:00–20:00
 * - 'custom'    → ברירת מחדל שמרנית (ראשון–חמישי 09:00–17:00) לכיוונון ידני בהמשך
 */
export function workingHoursPreset(key: HoursPresetKey): WorkingHoursRow[] {
  switch (key) {
    case 'every-day':
      return rows(EVERY_DAY, 9 * 60, 20 * 60);
    case 'custom':
      return rows(SUN_THU, 9 * 60, 17 * 60);
    case 'sun-thu':
    default:
      return rows(SUN_THU, 9 * 60, 18 * 60);
  }
}
