/**
 * עזרי זמן ואזור-זמן — ללא תלות חיצונית.
 *
 * מוסכמה: כל חותמות הזמן נשמרות ב-UTC. חישובי שעות עבודה נעשים לפי "שעון קיר"
 * מקומי של העסק (למשל Asia/Jerusalem), ואז מומרים ל-UTC. הפונקציות כאן
 * מטפלות נכון גם במעברי שעון קיץ/חורף (DST).
 */

export const DEFAULT_TZ = process.env.BUSINESS_TIMEZONE || 'Asia/Jerusalem';

export const MINUTES_IN_DAY = 24 * 60;

/**
 * היסט אזור-הזמן (במילישניות) עבור רגע נתון: tz פחות UTC.
 * לדוגמה עבור Asia/Jerusalem בקיץ יחזיר 3 שעות = 10_800_000.
 */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  // הרגע כפי שהוא נראה בשעון המקומי, מפורש כאילו היה UTC.
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second,
  );
  return asUtc - instant.getTime();
}

/**
 * המרת שעון-קיר מקומי (תאריך + דקות מתחילת היום) לרגע UTC.
 */
export function localWallTimeToUtc(
  year: number,
  month1: number, // 1-12
  day: number,
  minutesFromMidnight: number,
  timeZone: string = DEFAULT_TZ,
): Date {
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  const naiveUtc = Date.UTC(year, month1 - 1, day, hour, minute, 0);
  // ניחוש ראשון של ההיסט לפי הרגע ה"נאיבי", ואז תיקון נוסף למקרי DST.
  const guessOffset = tzOffsetMs(new Date(naiveUtc), timeZone);
  const candidate = naiveUtc - guessOffset;
  const preciseOffset = tzOffsetMs(new Date(candidate), timeZone);
  return new Date(naiveUtc - preciseOffset);
}

/** פירוק רגע UTC לחלקי שעון-קיר מקומי. */
export function utcToLocalParts(
  instant: Date,
  timeZone: string = DEFAULT_TZ,
): { year: number; month1: number; day: number; minutes: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const hour = Number(map.hour) === 24 ? 0 : Number(map.hour);
  return {
    year: Number(map.year),
    month1: Number(map.month),
    day: Number(map.day),
    minutes: hour * 60 + Number(map.minute),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

/** יום בשבוע (0=ראשון) עבור תאריך מסוג "YYYY-MM-DD" באזור הזמן הנתון. */
export function weekdayForDateString(
  dateStr: string,
  timeZone: string = DEFAULT_TZ,
): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  // חצות מקומי של אותו יום — נשתמש בו כדי לשלוף את יום השבוע.
  const utc = localWallTimeToUtc(y, m, d, 12 * 60, timeZone);
  return utcToLocalParts(utc, timeZone).weekday;
}

/** מחרוזת "YYYY-MM-DD" של "היום" באזור הזמן הנתון. */
export function todayDateString(timeZone: string = DEFAULT_TZ): string {
  return formatDateString(new Date(), timeZone);
}

export function formatDateString(instant: Date, timeZone: string = DEFAULT_TZ): string {
  const p = utcToLocalParts(instant, timeZone);
  return `${p.year}-${String(p.month1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** הוספת ימים למחרוזת תאריך "YYYY-MM-DD" (ללא תלות באזור זמן). */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** עיצוב שעה בעברית מתוך רגע UTC, למשל "14:30". */
export function formatTime(instant: Date, timeZone: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant);
}

/** עיצוב שעה מדקות-מתחילת-יום, למשל 870 → "14:30". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** עיצוב תאריך ארוך בעברית, למשל "יום שלישי, 12 באוגוסט 2026". */
export function formatLongDate(dateStr: string, timeZone: string = DEFAULT_TZ): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const noon = localWallTimeToUtc(y, m, d, 12 * 60, timeZone);
  return new Intl.DateTimeFormat('he-IL', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(noon);
}

/** עיצוב משך בדקות לעברית, למשל 90 → "שעה וחצי", 45 → "45 דק׳". */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} דק׳`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hPart = h === 1 ? 'שעה' : `${h} שעות`;
  if (m === 0) return hPart;
  if (m === 30) return `${hPart} וחצי`;
  return `${hPart} ו־${m} דק׳`;
}
