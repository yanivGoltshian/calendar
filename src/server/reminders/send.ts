import {
  getMessagingProvider,
  MessagingConfigError,
} from '@/server/providers/messaging';
import { t } from '@/i18n';
import { absoluteUrl } from '@/lib/seo';
import { DEFAULT_TZ, formatDateString, formatLongDate, formatTime } from '@/lib/time';

/**
 * שכבת שליחת תזכורות. מרכזת את בניית תוכן ההודעה ואת בחירת הערוץ.
 *
 * חשוב: מודול זה אינו מממש אינטגרציית SMS/WhatsApp משלו. הוא צורך אך ורק את
 * הממשק הציבורי של שכבת הספקים המשותפת (src/server/providers/messaging):
 * getMessagingProvider().sendSms / sendWhatsApp. בחירת הספק והקרדנשלס נקבעים
 * שם לפי משתני הסביבה. כאן רק מחליטים על העדפת הערוץ ומטפלים בשגיאות.
 */

export type ReminderChannel = 'SMS' | 'WHATSAPP';

/** נתוני התור הדרושים לבניית ושליחת ההודעה (תת-קבוצה של השאילתה בריפו). */
export type ReminderAppointment = {
  id: string;
  startAt: Date;
  confirmToken: string;
  business: { name: string; timezone: string | null };
  client: { name: string; phone: string };
};

/** בניית גוף הודעת התזכורת בעברית מתוך תבנית ה-i18n, עם קישור אישור מוחלט ונגיש. */
export function buildReminderBody(appt: ReminderAppointment): string {
  const tz = appt.business.timezone || DEFAULT_TZ;
  const dateStr = formatDateString(appt.startAt, tz);
  const date = formatLongDate(dateStr, tz);
  const time = formatTime(appt.startAt, tz);
  const url = absoluteUrl(`/c/${appt.confirmToken}`);
  const name = appt.client.name?.trim();
  const template = name ? t.reminders.message.body : t.reminders.message.bodyNoName;
  return template
    .replace('{name}', name ?? '')
    .replace('{business}', appt.business.name)
    .replace('{date}', date)
    .replace('{time}', time)
    .replace('{url}', url);
}

/**
 * תוצאת שליחה מובנית (איחוד מבחין):
 *   sent    — נשלח בפועל בערוץ שצוין (או נרשם ללוג במתאם console בפיתוח).
 *   skipped — הספק אינו כשיר לשליחה (למשל SMS_PROVIDER=console בפרודקשן, או
 *             חוסר קרדנשלס). לפי שער הקרדנשלס: לא שולחים אך כן מסמנים, כדי
 *             שהריצה תישאר אידמפוטנטית ולא תיתקע. אינו כשל.
 *   failed  — כשל שליחה חולף (רשת/דחיית ספק). אין לסמן — ייעשה ניסיון חוזר.
 */
export type SendReminderResult =
  | { status: 'sent'; channel: ReminderChannel }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; channel: ReminderChannel; error: string };

/** העדפת הערוץ. ברירת מחדל: WhatsApp אם מוגדר, אחרת נפילה חלקה ל-SMS.
 *  אפשר לכפות SMS בלבד עם REMINDER_CHANNEL=sms. */
function prefersWhatsApp(): boolean {
  return (process.env.REMINDER_CHANNEL ?? '').trim().toLowerCase() !== 'sms';
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * שליחת הודעת תזכורת ללקוח דרך שכבת הספקים המשותפת.
 * לעולם אינה זורקת חריגה — מחזירה תוצאה מובנית כדי שה-cron ירוץ על אצווה בבטחה.
 * מעדיף WhatsApp אם הספק תומך ומוגדר, אחרת נופל בחלקה ל-SMS.
 */
export async function sendReminder(appt: ReminderAppointment): Promise<SendReminderResult> {
  const body = buildReminderBody(appt);
  const to = appt.client.phone;

  let provider: ReturnType<typeof getMessagingProvider>;
  try {
    provider = getMessagingProvider();
  } catch (err) {
    // ספק לא כשיר (console בפרודקשן / חוסר קרדנשלס) — מסמנים בלי לשלוח.
    if (err instanceof MessagingConfigError) {
      return { status: 'skipped', reason: err.message };
    }
    return { status: 'failed', channel: 'SMS', error: errText(err) };
  }

  // העדפת WhatsApp: מנסים תחילה, ורק אם הערוץ אינו נתמך/מוגדר (שגיאת תצורה)
  // נופלים ל-SMS. כשל שליחה אמיתי ב-WhatsApp אינו נופל ל-SMS, כדי לא לשלוח פעמיים.
  if (prefersWhatsApp()) {
    try {
      await provider.sendWhatsApp(to, body);
      return { status: 'sent', channel: 'WHATSAPP' };
    } catch (err) {
      if (!(err instanceof MessagingConfigError)) {
        return { status: 'failed', channel: 'WHATSAPP', error: errText(err) };
      }
      // WhatsApp אינו זמין אצל הספק הזה — ממשיכים ל-SMS.
    }
  }

  try {
    await provider.sendSms(to, body);
    return { status: 'sent', channel: 'SMS' };
  } catch (err) {
    if (err instanceof MessagingConfigError) {
      return { status: 'skipped', reason: err.message };
    }
    return { status: 'failed', channel: 'SMS', error: errText(err) };
  }
}
