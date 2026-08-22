/**
 * עוזר לחישוב "ימי עסקים" בישראל עבור תקופת החסד של מחיקת מנוי.
 *
 * סוף השבוע הישראלי הוא שישי ושבת, ולכן ימי עסקים מדלגים עליהם. חגים ומועדים
 * אינם מנוכים כאן (החלטה מודעת: שמירה על לוגיקה פשוטה, דטרמיניסטית וללא תלות
 * בטבלת חגים משתנה). התוצאה שמרנית לטובת המשתמש: מועד המחיקה יוצא מעט מאוחר
 * יותר מאשר אם היינו מנכים גם חגים, ולכן חלון השחזור ארוך יותר ולא קצר יותר.
 *
 * החישוב מתבצע לפי לוח השנה באזור הזמן Asia/Jerusalem, בלי תלות באזור הזמן של
 * השרת (Container App רץ ב-UTC). כדי להימנע מהיסט שעון קיץ, אנו עובדים על תאריך
 * לוח (שנה/חודש/יום) ומקדמים ימים קלנדריים שלמים דרך חצות UTC, ולא מוסיפים שעות.
 */

const ISRAEL_TZ = 'Asia/Jerusalem';

// ימי סוף השבוע לפי getUTCDay: 5 = שישי, 6 = שבת.
const FRIDAY = 5;
const SATURDAY = 6;

/**
 * שולף את תאריך הלוח (שנה/חודש/יום) של רגע נתון כפי שהוא נראה באזור הזמן בישראל.
 * משתמש ב-Intl עם timeZone מפורש, ולכן אינו תלוי באזור הזמן של המכונה.
 */
function israeliCalendarDate(instant: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const lookup = (type: string): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number(value);
  };

  return { year: lookup('year'), month: lookup('month'), day: lookup('day') };
}

/**
 * האם התאריך (לפי לוח השנה בישראל) נופל בסוף השבוע הישראלי (שישי או שבת).
 */
export function isIsraeliWeekend(
  instant: Date,
  timeZone: string = ISRAEL_TZ,
): boolean {
  const { year, month, day } = israeliCalendarDate(instant, timeZone);
  // עוגן חצות UTC של תאריך הלוח — getUTCDay יציב ואינו מושפע משעון קיץ.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === FRIDAY || weekday === SATURDAY;
}

/**
 * מוסיף מספר ימי עסקים (מדלג שישי/שבת) לרגע נתון, ומחזיר רגע חדש שמייצג את
 * חצות UTC של תאריך היעד בלוח השנה הישראלי. מתאים כ-timestamp למחיקה מתוזמנת:
 * ההשוואה בפרג׳ היא purgeScheduledFor <= now, ולכן דיוק ברמת היום מספיק.
 *
 * @param start הרגע שממנו סופרים (בדרך כלל עכשיו).
 * @param businessDays מספר ימי העסקים להוספה (למשל 14). אפס ומספרים שליליים
 *   מוחזרים כתאריך ההתחלה עצמו (ללא הזזה).
 */
export function addBusinessDays(
  start: Date,
  businessDays: number,
  timeZone: string = ISRAEL_TZ,
): Date {
  const { year, month, day } = israeliCalendarDate(start, timeZone);
  // סמן שמתקדם ביחידות של יום קלנדרי שלם דרך חצות UTC (ללא הוספת שעות).
  let cursorMs = Date.UTC(year, month - 1, day);
  const DAY_MS = 24 * 60 * 60 * 1000;

  let remaining = Math.max(0, Math.floor(businessDays));
  while (remaining > 0) {
    cursorMs += DAY_MS;
    const weekday = new Date(cursorMs).getUTCDay();
    if (weekday !== FRIDAY && weekday !== SATURDAY) {
      remaining -= 1;
    }
  }

  return new Date(cursorMs);
}

/**
 * נוחות: מועד מחיקה סטנדרטי = 14 ימי עסקים מהרגע הנתון (ברירת מחדל עכשיו).
 */
export function addFourteenBusinessDays(start: Date = new Date()): Date {
  return addBusinessDays(start, 14);
}
