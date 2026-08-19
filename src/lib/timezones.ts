/**
 * רשימת אזורי זמן (IANA) לבורר עם חיפוש בטופס ההגדרות.
 * הערך הנשמר תמיד נשאר מזהה ה-IANA (למשל ‎Asia/Jerusalem);
 * רק התצוגה והחיפוש מתורגמים לעברית.
 *
 * משתמשים ב-Intl.supportedValuesOf כשזמין, עם רשימת גיבוי קבועה,
 * כדי שהבורר יעבוד גם בסביבות שאינן חושפות את הרשימה המלאה.
 */

/** אזור הזמן המהותי כברירת מחדל, ישראל. */
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

/** אפשרות תצוגה בבורר: מזהה IANA לשמירה + תווית עברית להצגה. */
export interface TimezoneOption {
  /** מזהה ה-IANA, זהו הערך הנשמר בפועל. */
  id: string;
  /** תווית עברית להצגה, למשל ‎'ישראל (ירושלים)'. */
  label: string;
}

/** תוויות עברית מלאות לאזורי זמן נפוצים. */
const HEBREW_LABELS: Record<string, string> = {
  'Asia/Jerusalem': 'ישראל (ירושלים)',
  'Asia/Tel_Aviv': 'ישראל (תל אביב)',
  UTC: 'זמן אוניברסלי מתואם (UTC)',
  'Europe/London': 'בריטניה (לונדון)',
  'Europe/Paris': 'צרפת (פריז)',
  'Europe/Berlin': 'גרמניה (ברלין)',
  'Europe/Madrid': 'ספרד (מדריד)',
  'Europe/Rome': 'איטליה (רומא)',
  'Europe/Moscow': 'רוסיה (מוסקבה)',
  'Europe/Amsterdam': 'הולנד (אמסטרדם)',
  'Europe/Athens': 'יוון (אתונה)',
  'Europe/Zurich': 'שווייץ (ציריך)',
  'Europe/Istanbul': 'טורקיה (איסטנבול)',
  'Asia/Istanbul': 'טורקיה (איסטנבול)',
  'America/New_York': 'ארצות הברית (ניו יורק)',
  'America/Chicago': 'ארצות הברית (שיקגו)',
  'America/Denver': 'ארצות הברית (דנוור)',
  'America/Los_Angeles': 'ארצות הברית (לוס אנג׳לס)',
  'America/Sao_Paulo': 'ברזיל (סאו פאולו)',
  'America/Toronto': 'קנדה (טורונטו)',
  'America/Mexico_City': 'מקסיקו (מקסיקו סיטי)',
  'Asia/Dubai': 'איחוד האמירויות (דובאי)',
  'Asia/Riyadh': 'ערב הסעודית (ריאד)',
  'Asia/Kolkata': 'הודו (קולקטה)',
  'Asia/Bangkok': 'תאילנד (בנגקוק)',
  'Asia/Shanghai': 'סין (שנחאי)',
  'Asia/Hong_Kong': 'הונג קונג',
  'Asia/Singapore': 'סינגפור',
  'Asia/Tokyo': 'יפן (טוקיו)',
  'Asia/Seoul': 'קוריאה הדרומית (סיאול)',
  'Asia/Jakarta': 'אינדונזיה (ג׳קרטה)',
  'Australia/Sydney': 'אוסטרליה (סידני)',
  'Australia/Melbourne': 'אוסטרליה (מלבורן)',
  'Africa/Cairo': 'מצרים (קהיר)',
  'Africa/Johannesburg': 'דרום אפריקה (יוהנסבורג)',
  'Pacific/Auckland': 'ניו זילנד (אוקלנד)',
};

/**
 * מילים נרדפות לחיפוש, מעבר למזהה ולתווית העברית.
 * ישראל היא אזרח מהמעלה הראשונה, נמצאת תמיד בכל צורות הכתיב.
 */
const EXTRA_SYNONYMS: Record<string, readonly string[]> = {
  'Asia/Jerusalem': [
    'ישראל',
    'ירושלים',
    'ישראלי',
    'אזור זמן',
    'Israel',
    'Jerusalem',
    'IL',
    'jer',
  ],
  'Asia/Tel_Aviv': ['ישראל', 'תל אביב', 'Israel', 'Tel Aviv', 'IL'],
  UTC: ['זמן אוניברסלי', 'אוניברסלי', 'UTC', 'GMT'],
};

/** סדר תצוגה לאזורים הפופולריים, ישראל בראש. */
const POPULAR_ORDER: readonly string[] = [
  'Asia/Jerusalem',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Istanbul',
  'Asia/Dubai',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Africa/Cairo',
  'Africa/Johannesburg',
];

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

/** רשימת מזהי IANA ייחודית, עם ‎Asia/Jerusalem מובטח בתוכה. */
function getTimezoneIds(): string[] {
  const intl = Intl as IntlWithSupportedValues;
  let list: string[];
  try {
    list =
      typeof intl.supportedValuesOf === 'function'
        ? intl.supportedValuesOf('timeZone')
        : [...FALLBACK_TIMEZONES];
  } catch {
    list = [...FALLBACK_TIMEZONES];
  }
  const unique = new Set<string>(list);
  unique.add(DEFAULT_TIMEZONE);
  return [...unique];
}

/** תווית עברית לאזור זמן; לזנב הארוך נגזרת שם העיר מהמזהה. */
export function labelForTimezone(id: string): string {
  const known = HEBREW_LABELS[id];
  if (known) return known;
  const city = id.split('/').pop() ?? id;
  return city.replace(/_/g, ' ');
}

/**
 * מחזיר את רשימת אפשרויות הבורר: ישראל בראש, אחריה אזורים פופולריים,
 * ולבסוף שאר האזורים ממוינים לפי התווית העברית.
 */
export function getTimezoneOptions(): TimezoneOption[] {
  const ids = getTimezoneIds();
  const present = new Set(ids);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of POPULAR_ORDER) {
    if (present.has(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }

  const rest = ids
    .filter((id) => !seen.has(id))
    .sort((a, b) => labelForTimezone(a).localeCompare(labelForTimezone(b), 'he'));

  ordered.push(...rest);
  return ordered.map((id) => ({ id, label: labelForTimezone(id) }));
}

/**
 * מנרמל מחרוזת לחיפוש: מסיר ניקוד עברי וסימני הטעמה לטיניים,
 * מוריד רישיות, מנקה סימני פיסוק ומאחד מפרידים (‎_ / ) לרווח.
 * כך החיפוש חסר רגישות לרישיות ולניקוד, ומתאים גם עם/בלי גרש וסוגריים.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // סימני הטעמה לטיניים
    .replace(/[\u0591-\u05c7]/g, '') // ניקוד וטעמים עבריים
    .toLowerCase()
    .replace(/["'()[\]{}׳״]/g, '') // סימני פיסוק להסרה
    .replace(/[_/,.\-]+/g, ' ') // מפרידים לרווח
    .replace(/\s+/g, ' ')
    .trim();
}

/** אוסף מחרוזות החיפוש של אפשרות: מזהה, תווית ומילים נרדפות. */
function haystacksFor(option: TimezoneOption): string[] {
  const parts = [option.id, option.label, ...(EXTRA_SYNONYMS[option.id] ?? [])];
  return parts.map(normalizeForSearch).filter(Boolean);
}

/**
 * מסנן אפשרויות אזור זמן לפי טקסט חיפוש (typeahead).
 * מתאים מול המזהה, התווית העברית והמילים הנרדפות גם יחד,
 * ומדרג התאמות שמתחילות במחרוזת לפני התאמות באמצע.
 * שאילתה ריקה מחזירה את הרשימה כפי שהיא (ישראל בראש).
 */
export function filterTimezoneOptions(
  options: readonly TimezoneOption[],
  query: string,
): TimezoneOption[] {
  const q = normalizeForSearch(query);
  if (!q) return [...options];

  const starts: TimezoneOption[] = [];
  const contains: TimezoneOption[] = [];
  for (const option of options) {
    let rank = -1; // ‎-1 אין, 0 מתחיל, 1 מכיל
    for (const hay of haystacksFor(option)) {
      const idx = hay.indexOf(q);
      if (idx === 0) {
        rank = 0;
        break;
      }
      if (idx > 0 && rank < 1) rank = 1;
    }
    if (rank === 0) starts.push(option);
    else if (rank === 1) contains.push(option);
  }
  return [...starts, ...contains];
}
