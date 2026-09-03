import { z } from 'zod';
import { BusinessType, ReminderChannel } from '@prisma/client';
import { MAX_HERO_IMAGES } from '@/lib/publicPageStyle';
import {
  MESSAGE_KEYS,
  getTemplateDef,
  type MessageChannel,
} from '@/server/messages/registry';
import type { MessageTemplateInput } from '@/server/messages/save';
import type {
  BusinessProfileInput,
  BookingPolicyInput,
  RemindersInput,
  OwnerNotificationsInput,
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

/**
 * ניתוח תמונות ההירו של עמוד הנחיתה מתוך טופס ההגדרות (עד MAX_HERO_IMAGES).
 * מקביל ל-setHeroImage באשף ההקמה: שדות בשם heroImage0..heroImageN, נחתכים
 * לשתיים לכל היותר. מנתח טהור — המיזוג ל-landingContent הקיים נעשה בשכבת ה-Action
 * (יש שם גישה ל-business), כדי לא לדרוס שדות נחיתה אחרים.
 */
export function parseLandingHeroImages(fd: FormData): string[] {
  const images: string[] = [];
  for (let i = 0; i < MAX_HERO_IMAGES; i++) {
    const url = str(fd, `heroImage${i}`);
    if (url) images.push(url);
  }
  return images;
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

/**
 * ניתוח תצורת התזכורות. שעות התראה לא חוקיות ⇐ שגיאה; ערוץ לא חוקי ⇐ AUTO.
 * אכיפת שרת: כשהעסק אינו אקסקלוסיב, ערוצי מסרון/יחד נכפים חזרה לדוא"ל גם אם
 * ה-UI נעקף.
 */
export function parseReminders(
  fd: FormData,
  isExclusive = true,
): ParseResult<RemindersInput> {
  const leadParsed = z.coerce.number().int().min(0).safeParse(fd.get('reminderLeadHours'));
  if (!leadParsed.success) return { ok: false, error: 'number' };

  const rawChannel = str(fd, 'reminderChannel');
  let channel: ReminderChannel = reminderChannelValues.includes(rawChannel)
    ? (rawChannel as ReminderChannel)
    : ReminderChannel.AUTO;
  if (
    !isExclusive &&
    (channel === ReminderChannel.SMS || channel === ReminderChannel.BOTH)
  ) {
    channel = ReminderChannel.EMAIL;
  }

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

/**
 * ניתוח מתגי התראות בעל העסק (הזמנה/ביטול/פוש). כל שדה הוא תיבת סימון; ברירות
 * המחדל בסכימה (הזמנה/ביטול/פוש דלוקים) חלות רק ביצירת שורה חדשה, ולכן
 * המנתח מחזיר את הערך המפורש של הטופס בכל שמירה.
 */
export function parseOwnerNotifications(fd: FormData): ParseResult<OwnerNotificationsInput> {
  return {
    ok: true,
    data: {
      notifyOnBooking: checkbox(fd, 'notifyOnBooking'),
      notifyOnCancellation: checkbox(fd, 'notifyOnCancellation'),
      pushEnabled: checkbox(fd, 'pushEnabled'),
    },
  };
}

/**
 * ניתוח דריסות תבניות ההודעות ללקוחות מתוך הטופס. עובר על כל מפתח × ערוץ נתמך
 * (שמות שדות `tmpl.<key>.<channel>.body` ו-`...subject` למייל), חותך רווחים,
 * ומחזיר את הערכים הגולמיים. ההחלטה אם לשמור דריסה או לשחזר לברירת-המחדל נעשית
 * בשכבת ה-repo (resolveTemplateSave), ולכן כאן אין וולידציה שנכשלת — מנתח טהור.
 */
export function parseMessageTemplates(fd: FormData): MessageTemplateInput[] {
  const out: MessageTemplateInput[] = [];
  for (const key of MESSAGE_KEYS) {
    const def = getTemplateDef(key);
    (['email', 'sms'] as MessageChannel[]).forEach((channel) => {
      if (!def.channels[channel]) return;
      const body = str(fd, `tmpl.${key}.${channel}.body`);
      const subject =
        channel === 'email' ? nullableStr(fd, `tmpl.${key}.${channel}.subject`) : null;
      out.push({ key, channel, subject, body });
    });
  }
  return out;
}
