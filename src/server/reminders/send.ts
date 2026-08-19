import {
  getMessagingProvider,
  MessagingConfigError,
} from '@/server/providers/messaging';
import { emailConfigured, sendReminderEmail } from '@/server/providers/email';
import { resolveReminderChannel } from '@/server/reminders/resolveChannel';
import { t } from '@/i18n';
import { absoluteUrl } from '@/lib/seo';
import { DEFAULT_TZ, formatDateString, formatLongDate, formatTime } from '@/lib/time';

/**
 * שכבת שליחת תזכורות. מרכזת את בניית תוכן ההודעה ואת שליחתה בערוץ שנגזר ללקוח.
 *
 * הערוץ בפועל נקבע ב-resolveReminderChannel לפי העדפת העסק (reminderChannel) וזהות
 * הלקוח: במצב AUTO — מייל אם הלקוח נרשם עם מייל, אחרת מסרון לפי הטלפון; בעקיפה
 * ידנית (EMAIL/SMS) מכבדים את הבחירה כל עוד ליעד יש כתובת. לעולם לא שולחים ליעד ריק.
 *
 * חשוב: מודול זה אינו מממש אינטגרציית WhatsApp/SMS משלו ואינו קורא ל-Meta ישירות.
 * ערוץ המסרון נשלח דרך הממשק הציבורי של שכבת הספקים המשותפת
 * (src/server/providers/messaging): getMessagingProvider().sendWhatsApp. ערוץ המייל
 * נשלח דרך src/server/providers/email (sendReminderEmail). כאן רק בונים את התוכן
 * בעברית בעזרת i18n, גוזרים את הערוץ, ומטפלים בשגיאות ובחוסר תצורה בבטחה.
 *
 * הערת מינוח: תווית האפשרות בהגדרות היא "מסרון (SMS)" אך ערוץ המסרון בפועל נשלח
 * כ-WhatsApp דרך השכבה המשותפת. הפער תועד להמשך ואינו מטופל כאן.
 */

export type ReminderChannel = 'WHATSAPP' | 'EMAIL';

/** נתוני התור הדרושים לבניית ושליחת ההודעה (תת-קבוצה של השאילתה בריפו). */
export type ReminderAppointment = {
  id: string;
  startAt: Date;
  confirmToken: string;
  business: {
    name: string;
    timezone: string | null;
    // ערוץ התזכורת מגיע מה-relation settings של העסק, שהוא nullable בסכימה. כאשר
    // אין רשומת settings — ברירת המחדל היא AUTO (נגזר בשכבת השליחה, ראו sendReminder).
    settings: { reminderChannel: string } | null;
  };
  client: { name: string; phone?: string | null; email?: string | null };
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

/** בריחת תווי HTML בסיסית לתוכן שמקורו במשתמש (שם עסק/לקוח) לפני הטמעה ב-HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * בניית תוכן מייל התזכורת (נושא + גוף טקסט + HTML נגיש RTL).
 * הטקסט זהה לגוף הודעת המסרון (buildReminderBody) לשמירת אחידות; ה-HTML עוטף
 * אותו בכיווניות ימין-לשמאל והופך את קישור האישור לעוגן לחיץ.
 */
export function buildReminderEmail(appt: ReminderAppointment): {
  subject: string;
  text: string;
  html: string;
} {
  const text = buildReminderBody(appt);
  const subject = t.reminders.message.emailSubject.replace('{business}', appt.business.name);
  const url = absoluteUrl(`/c/${appt.confirmToken}`);
  const body = escapeHtml(text).replace(
    escapeHtml(url),
    `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`,
  );
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl">` +
    `<p>${body}</p>` +
    `</body></html>`;
  return { subject, text, html };
}

/**
 * תוצאת שליחה מובנית (איחוד מבחין):
 *   sent    — נשלח בפועל בערוץ שנגזר (WhatsApp או מייל), או נרשם ללוג במתאם
 *             console בפיתוח.
 *   skipped — לא ניתן/נדרש לשלוח, אך מסמנים כדי שהריצה תישאר אידמפוטנטית ולא
 *             תיתקע. מכסה: יעד חסר (למשל AUTO ללקוח בלי מייל ובלי טלפון), ערוץ
 *             שהוגדר ידנית ללא כתובת מתאימה, וספק לא כשיר (console בפרודקשן /
 *             חוסר קרדנשלס / מייל לא מוגדר). אינו כשל.
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
 * שליחת תזכורת בערוץ המסרון (WhatsApp) דרך שכבת הספקים המשותפת.
 * היעד (to) נגזר מראש ומובטח שאינו ריק. שגיאת תצורה => skipped (no-op-אבל-מסומן).
 */
async function sendViaWhatsApp(
  appt: ReminderAppointment,
  to: string,
): Promise<SendReminderResult> {
  const body = buildReminderBody(appt);

  let provider: ReturnType<typeof getMessagingProvider>;
  try {
    provider = getMessagingProvider();
  } catch (err) {
    if (err instanceof MessagingConfigError) {
      return { status: 'skipped', reason: err.message };
    }
    return { status: 'failed', channel: 'WHATSAPP', error: errText(err) };
  }

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

/**
 * שליחת תזכורת בערוץ המייל דרך src/server/providers/email.
 * אם ספק המייל אינו מוגדר — מדלגים בחן (skipped) במקום לדווח "נשלח" על נפילת console.
 * היעד (to) נגזר מראש ומובטח שאינו ריק.
 */
async function sendViaEmail(
  appt: ReminderAppointment,
  to: string,
): Promise<SendReminderResult> {
  if (!emailConfigured) {
    return { status: 'skipped', reason: 'email provider not configured' };
  }
  const { subject, text, html } = buildReminderEmail(appt);
  try {
    await sendReminderEmail(to, subject, text, html);
    return { status: 'sent', channel: 'EMAIL' };
  } catch (err) {
    return { status: 'failed', channel: 'EMAIL', error: errText(err) };
  }
}

/**
 * שליחת הודעת תזכורת ללקוח בערוץ שנגזר לו (resolveReminderChannel).
 * לעולם אינה זורקת חריגה — מחזירה תוצאה מובנית כדי שה-cron ירוץ על אצווה בבטחה,
 * ולעולם אינה שולחת ליעד ריק. יעד חסר או ספק לא כשיר => skipped (no-op-אבל-מסומן);
 * כשל חולף => failed (ניסיון חוזר).
 */
export async function sendReminder(appt: ReminderAppointment): Promise<SendReminderResult> {
  // ה-relation settings הוא nullable; כשאין רשומה מתייחסים לברירת המחדל AUTO (כמו
  // בסכימה), כך שהערוץ נגזר מזהות הלקוח ואף לקוח לא נשמט בגלל היעדר הגדרות.
  const channelPref = appt.business.settings?.reminderChannel ?? 'AUTO';
  const resolved = resolveReminderChannel(appt.client, channelPref);
  if (resolved.kind === 'skip') {
    return { status: 'skipped', reason: resolved.reason };
  }

  // ערוץ המסרון (SMS) נשלח בפועל כ-WhatsApp דרך השכבה המשותפת; ערוץ המייל דרך email.
  if (resolved.channel === 'EMAIL') {
    return sendViaEmail(appt, resolved.to);
  }
  return sendViaWhatsApp(appt, resolved.to);
}
