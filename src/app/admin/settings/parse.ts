import { z } from 'zod';
import { BusinessType, ReminderChannel } from '@prisma/client';
import type {
  BusinessProfileInput,
  BookingPolicyInput,
  TransparencyInput,
  RemindersInput,
} from '@/server/repos/settings';

/**
 * מנתחי FormData טהורים לסעיפי ההגדרות וההקמה. אין כאן גישה ל-DB או
 * ל-Server Actions, ולכן אפשר לבדוק את מיפוי השדות והוולידציה ביחידה.
 * הן פעולות ההגדרות והן אשף ההקמה משתמשים באותם מנתחים כדי למנוע כפילות.
 */

/** מצב אחיד לכל טופס הגדרות (useActionState). */
export type SaveState = { ok: boolean; error?: string };

/** תוצאת ניתוח: הצלחה עם נתונים או כשל עם קוד שגיאה. */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** קורא ערך טקסט נקי מ-FormData. */
export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

/** מחזיר מחרוזת או null כשריק. */
export function nullableStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v ? v : null;
}

/** תיבת סימון: קיימת ומסומנת ⇐ true. */
export function checkbox(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

const businessTypeValues = Object.values(BusinessType) as string[];
const reminderChannelValues = Object.values(ReminderChannel) as string[];

/** ניתוח פרופיל העסק. שם חובה; סוג לא חוקי ⇐ שגיאה. */
export function parseProfile(fd: FormData): ParseResult<BusinessProfileInput> {
  const name = str(fd, 'name');
  if (!name) return { ok: false, error: 'name' };

  const rawType = str(fd, 'type');
  let type: BusinessType | null = null;
  if (rawType) {
    if (!businessTypeValues.includes(rawType)) return { ok: false, error: 'bad_request' };
    type = rawType as BusinessType;
  }

  return {
    ok: true,
    data: {
      name,
      type,
      phone: nullableStr(fd, 'phone'),
      address: nullableStr(fd, 'address'),
      description: nullableStr(fd, 'description'),
      instagramUrl: nullableStr(fd, 'instagramUrl'),
      logoUrl: nullableStr(fd, 'logoUrl'),
      coverImageUrl: nullableStr(fd, 'coverImageUrl'),
      brandColor: nullableStr(fd, 'brandColor'),
      timezone: str(fd, 'timezone') || 'Asia/Jerusalem',
    },
  };
}

export const policySchema = z.object({
  minLeadTimeMinutes: z.coerce.number().int().min(0),
  cancellationWindowHours: z.coerce.number().int().min(0),
  slotGranularityMinutes: z.coerce.number().int().min(1),
  maxAdvanceBookingDays: z.coerce.number().int().min(1),
});

/** ניתוח מדיניות ההזמנה. מספרים לא חוקיים ⇐ שגיאה. */
export function parsePolicy(fd: FormData): ParseResult<BookingPolicyInput> {
  const parsed = policySchema.safeParse({
    minLeadTimeMinutes: fd.get('minLeadTimeMinutes'),
    cancellationWindowHours: fd.get('cancellationWindowHours'),
    slotGranularityMinutes: fd.get('slotGranularityMinutes'),
    maxAdvanceBookingDays: fd.get('maxAdvanceBookingDays'),
  });
  if (!parsed.success) return { ok: false, error: 'number' };

  return {
    ok: true,
    data: {
      ...parsed.data,
      bookingRequiresApproval: checkbox(fd, 'bookingRequiresApproval'),
    },
  };
}

/** ניתוח מתגי השקיפות בעמוד הציבורי. תמיד תקין. */
export function parseTransparency(fd: FormData): TransparencyInput {
  return {
    showPricesPublic: checkbox(fd, 'showPricesPublic'),
    showDurationPublic: checkbox(fd, 'showDurationPublic'),
    showStaffPublic: checkbox(fd, 'showStaffPublic'),
  };
}

/** ניתוח תצורת התזכורות. שעות התראה לא חוקיות ⇐ שגיאה; ערוץ לא חוקי ⇐ AUTO. */
export function parseReminders(fd: FormData): ParseResult<RemindersInput> {
  const leadParsed = z.coerce.number().int().min(0).safeParse(fd.get('reminderLeadHours'));
  if (!leadParsed.success) return { ok: false, error: 'number' };

  const rawChannel = str(fd, 'reminderChannel');
  const channel: ReminderChannel = reminderChannelValues.includes(rawChannel)
    ? (rawChannel as ReminderChannel)
    : ReminderChannel.AUTO;

  return {
    ok: true,
    data: {
      remindersEnabled: checkbox(fd, 'remindersEnabled'),
      reminderChannel: channel,
      reminderLeadHours: leadParsed.data,
      confirmationRequired: checkbox(fd, 'confirmationRequired'),
    },
  };
}
