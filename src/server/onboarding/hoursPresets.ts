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

/** קלט יום בבחירה הידנית: יום בשבוע, האם פתוח, ושעות פתיחה/סגירה בפורמט "HH:MM". */
export type CustomHoursInput = {
  weekday: number;
  open: boolean;
  start: string;
  end: string;
};

/** "HH:MM" → דקות מחצות היום; מחזיר null לקלט לא-תקין. */
function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * ממיר בחירת ימים ושעות ידנית לשורות שעות תקינות עבור setBusinessHours.
 * מדלג על ימים סגורים, על ימים מחוץ לטווח 0–6, ועל שעות לא-תקינות או כאלה
 * שבהן שעת הסיום אינה מאוחרת משעת ההתחלה. מחזיר מערך ממוין לפי יום, ללא הפסקות.
 */
export function parseCustomHours(input: CustomHoursInput[]): WorkingHoursRow[] {
  const result: WorkingHoursRow[] = [];
  for (const day of input) {
    if (!day || day.open !== true) continue;
    if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) continue;
    const startMinute = hhmmToMinutes(String(day.start ?? ''));
    const endMinute = hhmmToMinutes(String(day.end ?? ''));
    if (startMinute === null || endMinute === null || endMinute <= startMinute) continue;
    result.push({ weekday: day.weekday, startMinute, endMinute, breaks: [] });
  }
  result.sort((a, b) => a.weekday - b.weekday);
  return result;
}
