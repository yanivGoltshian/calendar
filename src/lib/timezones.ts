/**
 * רשימת אזורי זמן (IANA) לבורר עם חיפוש בטופס ההגדרות.
 * משתמשים ב-Intl.supportedValuesOf כשזמין, עם רשימת גיבוי קבועה,
 * כדי שהבורר יעבוד גם בסביבות שאינן חושפות את הרשימה המלאה.
 */

/** אזור הזמן המהותי כברירת מחדל — ישראל. */
export const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

/** רשימת גיבוי לאזורי זמן נפוצים, אם Intl.supportedValuesOf לא זמין. */
export const FALLBACK_TIMEZONES: readonly string[] = [
  'Asia/Jerusalem',
  'Asia/Tel_Aviv',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Istanbul',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Africa/Cairo',
  'Africa/Johannesburg',
];

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

/**
 * מחזיר רשימת אזורי זמן ממוינת וייחודית, עם ‎Asia/Jerusalem מובטח בתוכה.
 * נופל לרשימת הגיבוי כשה-API לא זמין או נכשל.
 */
export function getTimezones(): string[] {
  const intl = Intl as IntlWithSupportedValues;
  let list: string[];
  try {
    list = typeof intl.supportedValuesOf === 'function'
      ? intl.supportedValuesOf('timeZone')
      : [...FALLBACK_TIMEZONES];
  } catch {
    list = [...FALLBACK_TIMEZONES];
  }
  const unique = new Set<string>(list);
  unique.add(DEFAULT_TIMEZONE);
  return [...unique].sort((a, b) => a.localeCompare(b));
}

/** מנרמל מחרוזת לחיפוש: אותיות קטנות, ‎_ ו-‎/ הופכים לרווח. */
function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/[_/]+/g, ' ').trim();
}

/**
 * מסנן רשימת אזורי זמן לפי טקסט חיפוש (typeahead).
 * החיפוש עמיד ל-‎_ ול-‎/ (כך ש"new york" מתאים ל-America/New_York),
 * ומדרג התאמות שמתחילות במחרוזת לפני התאמות באמצע.
 */
export function filterTimezones(list: readonly string[], query: string): string[] {
  const q = normalizeForSearch(query);
  if (!q) return [...list];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const tz of list) {
    const norm = normalizeForSearch(tz);
    const idx = norm.indexOf(q);
    if (idx === 0) starts.push(tz);
    else if (idx > 0) contains.push(tz);
  }
  return [...starts, ...contains];
}
