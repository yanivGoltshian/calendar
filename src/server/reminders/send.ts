import {
  getMessagingProvider,
  MessagingConfigError,
} from '@/server/providers/messaging';
import { t } from '@/i18n';
import { absoluteUrl } from '@/lib/seo';
import { DEFAULT_TZ, formatDateString, formatLongDate, formatTime } from '@/lib/time';

/**
 * שכבת שליחת תזכורות. מרכזת את בניית תוכן ההודעה ואת שליחתה בערוץ WhatsApp.
 *
 * חשוב: מודול זה אינו מממש אינטגרציית WhatsApp/SMS משלו ואינו קורא ל-Meta ישירות.
 * הוא צורך אך ורק את הממשק הציבורי של שכבת הספקים המשותפת
 * (src/server/providers/messaging): getMessagingProvider().sendWhatsApp. הערוץ
 * האמיתי הוא WhatsApp Cloud API, ובחירת הספק, הקרדנשלס ותבנית ה-utility לתזכורת
 * (שם התבנית מגיע ממשתנה הסביבה WHATSAPP_REMINDER_TEMPLATE שהשכבה חושפת) נקבעים
 * כולם בשכבה. כאן רק בונים את הגוף בעברית בעזרת i18n ומטפלים בשגיאות.
 */

export type ReminderChannel = 'WHATSAPP';

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
 *   sent    — נשלח בפועל ב-WhatsApp (או נרשם ללוג במתאם console בפיתוח).
 *   skipped — הספק אינו כשיר לשליחה (למשל MESSAGING_PROVIDER=console בפרודקשן, או
 *             חוסר קרדנשלס). לפי שער הקרדנשלס: לא שולחים אך כן מסמנים, כדי
 *             שהריצה תישאר אידמפוטנטית ולא תיתקע. אינו כשל.
 *   failed  — כשל שליחה חולף (רשת/דחיית ספק). אין לסמן — ייעשה ניסיון חוזר.
 */
export type SendReminderResult =
  | { status: 'sent'; channel: ReminderChannel }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; channel: ReminderChannel; error: string };

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * שליחת הודעת תזכורת ללקוח דרך שכבת הספקים המשותפת, בערוץ WhatsApp בלבד.
 * לעולם אינה זורקת חריגה — מחזירה תוצאה מובנית כדי שה-cron ירוץ על אצווה בבטחה.
 * שגיאת תצורה (ספק console / חוסר קרדנשלס) מסומנת כ-skipped: מחושב ומסומן אך
 * לא נשלח בפועל (no-op-אבל-מסומן). כשל חולף מסומן כ-failed ויקבל ניסיון חוזר.
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
    return { status: 'failed', channel: 'WHATSAPP', error: errText(err) };
  }

  // ערוץ יחיד: WhatsApp דרך השכבה המשותפת. שם תבנית ה-utility נבחר בשכבה
  // (WHATSAPP_REMINDER_TEMPLATE). שגיאת תצורה => skipped (no-op-אבל-מסומן).
  try {
    await provider.sendWhatsApp(to, body);
    return { status: 'sent', channel: 'WHATSAPP' };
  } catch (err) {
    if (err instanceof MessagingConfigError) {
      return { status: 'skipped', reason: err.message };
    }
    return { status: 'failed', channel: 'WHATSAPP', error: errText(err) };
  }
}
