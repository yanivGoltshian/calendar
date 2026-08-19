import { BusinessType } from '@prisma/client';

/**
 * פענוח וולידציה של קלט טופס יצירת העסק (אפיק D1 + שאלות שיווק D2).
 *
 * חולץ מ-`src/app/business/new/actions.ts` לפונקציה טהורה כדי שיהיה ניתן לבדוק ישירות
 * שעסק נוצר עם `phone` ריק (null) בהצלחה, ושרק קלט לא-תקין באמת נדחה. אין שינוי
 * התנהגות: השם חובה, הסוג אופציונלי אך אם סופק חייב להיות חוקי, והטלפון/כתובת
 * אופציונליים (ריק → null). מפתחות השיווק שאינם ברשימה מנוקים ל-null.
 */

const VALID_TYPES = new Set(Object.values(BusinessType) as string[]);

const PRIOR_CALENDAR_KEYS = new Set([
  'none',
  'paper',
  'google',
  'spreadsheet',
  'otherSystem',
  'other',
]);
const REFERRAL_KEYS = new Set(['google', 'instagram', 'facebook', 'tiktok', 'friend', 'other']);

export type ParsedBusinessInput = {
  name: string;
  type: BusinessType | null;
  phone: string | null;
  address: string | null;
  priorCalendar: string | null;
  referralSource: string | null;
};

export type ParseBusinessResult =
  | { ok: true; value: ParsedBusinessInput }
  | { ok: false; error: 'name' | 'type' };

/**
 * @param get קורא שדה טופס לפי שם ומחזיר מחרוזת או null (מתאם ל-FormData).
 */
export function parseCreateBusinessInput(
  get: (key: string) => string | null,
): ParseBusinessResult {
  const name = (get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'name' };

  const rawType = (get('type') ?? '').trim();
  if (rawType && !VALID_TYPES.has(rawType)) return { ok: false, error: 'type' };
  const type = rawType ? (rawType as BusinessType) : null;

  const phone = (get('phone') ?? '').trim() || null;
  const address = (get('address') ?? '').trim() || null;

  const priorCalendarRaw = (get('priorCalendar') ?? '').trim();
  const priorCalendar = PRIOR_CALENDAR_KEYS.has(priorCalendarRaw) ? priorCalendarRaw : null;
  const referralRaw = (get('referralSource') ?? '').trim();
  const referralSource = REFERRAL_KEYS.has(referralRaw) ? referralRaw : null;

  return {
    ok: true,
    value: { name, type, phone, address, priorCalendar, referralSource },
  };
}
