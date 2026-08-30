import { emailConfigured, sendReminderEmail } from '@/server/providers/email';
import {
  resolveReminderChannel,
  resolveReminderTargets,
} from '@/server/reminders/resolveChannel';
import { sendGuardedSms } from '@/server/billing/costGuard';
import { t } from '@/i18n';
import { absoluteUrl } from '@/lib/seo';
import { DEFAULT_TZ, formatDateString, formatLongDate, formatTime } from '@/lib/time';

/**
 * שכבת שליחת תזכורות. מרכזת את בניית תוכן ההודעה ואת שליחתה ביעדים שנגזרו ללקוח.
 *
 * היעדים בפועל נקבעים ב-resolveReminderTargets לפי העדפת העסק (reminderChannel),
 * זהות הלקוח, והרשאת המסרון לפי החבילה (allowSms). ייתכנו שני יעדים: בהעדפת BOTH
 * (מייל ומסרון יחד) של עסק אקסקלוסיב נשלחות שתי הודעות. במצב AUTO אקסקלוסיב מעדיף
 * מסרון (אם יש טלפון), אחרת מייל; בעקיפה ידנית (EMAIL/SMS/BOTH) מכבדים את הבחירה
 * כל עוד ליעד יש כתובת. לעולם לא שולחים ליעד ריק.
 *
 * ניתוב לפי חבילה: המסרון בתשלום ללקוח דלוק רק בחבילת אקסקלוסיב. הדגל isExclusive
 * מוזרם מהמטפל (canSendPaidClientSms) ומועבר כ-allowSms; בפרימיום/בסיס לעולם לא
 * נגזר מסרון — התזכורת נשלחת במייל בלבד, ו-BOTH יורד למייל בלבד.
 *
 * ערוץ המסרון נשלח דרך נקודת האכיפה המרכזית sendGuardedSms (src/server/billing/
 * costGuard), שבודקת את תקרת העלות החודשית של העסק, שולחת בפועל דרך שכבת הספקים,
 * ומתעדת עלות ביומן ההודעות. חסימה בתקרה מוחזרת כ-skipped (מסומן, ללא ניסיון חוזר).
 * ערוץ המייל נשלח דרך src/server/providers/email (sendReminderEmail). כאן רק בונים
 * את התוכן בעברית בעזרת i18n, גוזרים את היעדים, ומטפלים בשגיאות בבטחה.
 */

export type ReminderChannel = 'SMS' | 'EMAIL';

/** נתוני התור הדרושים לבניית ושליחת ההודעה (תת-קבוצה של השאילתה בריפו). */
export type ReminderAppointment = {
  id: string;
  startAt: Date;
  confirmToken: string;
  business: {
    id: string;
    name: string;
    timezone: string | null;
    // האם העסק רשאי לשלוח מסרון בתשלום ללקוח (אקסקלוסיב פעיל). מחושב במטפל דרך
    // canSendPaidClientSms ומועבר כ-allowSms לגזירת הערוץ. בפרימיום/בסיס false.
    isExclusive: boolean;
    // תצורת התזכורות מגיעה מה-relation settings של העסק, שהוא nullable בסכימה.
    // reminderChannel — כאשר אין רשומת settings ברירת המחדל היא AUTO (נגזר בשכבת
    // השליחה, ראו sendReminder). confirmationRequired — קובע אם ההודעה כוללת את
    // קישור האישור /c/<token>: ברירת המחדל בסכימה היא true, ולכן עסקים קיימים
    // ממשיכים לכלול את הקישור, והמתג מאפשר לכבות (ראו buildReminderBody/
    // buildReminderEmail). reminderLeadHours/remindersEnabled נקראים במטפל ה-cron
    // ובשאילתת הריפו ולא כאן, אך נכללים בטיפוס כדי שצורת ה-settings תתאים לתוצאת
    // השאילתה.
    settings: {
      reminderChannel: string;
      remindersEnabled?: boolean;
      reminderLeadHours?: number;
      confirmationRequired?: boolean;
    } | null;
  };
  client: { id: string; name: string; phone?: string | null; email?: string | null };
};

/**
 * בניית גוף הודעת התזכורת בעברית מתוך תבנית ה-i18n.
 *
 * שער אישור הגעה: קישור האישור /c/<token> נכלל בהודעה כאשר העסק לא כיבה את
 * confirmationRequired (ברירת המחדל בסכימה היא true — עסקים קיימים ממשיכים לכלול
 * את הקישור). כשההגדרה כבויה נשלחת תזכורת רגילה מתבנית ללא קישור (bodyNoConfirm/
 * bodyNoNameNoConfirm). בכל מקרה יש תבנית עם שם ותבנית בלי שם, לפי הימצאות שם הלקוח.
 */
export function buildReminderBody(appt: ReminderAppointment): string {
  const tz = appt.business.timezone || DEFAULT_TZ;
  const dateStr = formatDateString(appt.startAt, tz);
  const date = formatLongDate(dateStr, tz);
  const time = formatTime(appt.startAt, tz);
  const name = appt.client.name?.trim();
  const confirmationRequired = appt.business.settings?.confirmationRequired ?? true;

  if (!confirmationRequired) {
    const template = name
      ? t.reminders.message.bodyNoConfirm
      : t.reminders.message.bodyNoNameNoConfirm;
    return template
      .replace('{name}', name ?? '')
      .replace('{business}', appt.business.name)
      .replace('{date}', date)
      .replace('{time}', time);
  }

  const url = absoluteUrl(`/c/${appt.confirmToken}`);
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
 * אותו בכיווניות ימין-לשמאל. קישור האישור הופך לעוגן לחיץ כאשר confirmationRequired
 * דלוק (ברירת המחדל true) — אז הקישור קיים בטקסט; אם כובה אין קישור והטקסט נשלח כמות שהוא.
 */
export function buildReminderEmail(appt: ReminderAppointment): {
  subject: string;
  text: string;
  html: string;
} {
  const text = buildReminderBody(appt);
  const subject = t.reminders.message.emailSubject.replace('{business}', appt.business.name);
  const confirmationRequired = appt.business.settings?.confirmationRequired ?? true;
  let body = escapeHtml(text);
  if (confirmationRequired) {
    const url = absoluteUrl(`/c/${appt.confirmToken}`);
    body = body.replace(
      escapeHtml(url),
      `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`,
    );
  }
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl">` +
    `<p>${body}</p>` +
    `</body></html>`;
  return { subject, text, html };
}

/**
 * תוצאת שליחה מובנית (איחוד מבחין):
 *   sent    — נשלח בפועל בערוץ שנגזר (מסרון או מייל), או נרשם ללוג במתאם
 *             console בפיתוח.
 *   skipped — לא ניתן/נדרש לשלוח, אך מסמנים כדי שהריצה תישאר אידמפוטנטית ולא
 *             תיתקע. מכסה: יעד חסר (למשל AUTO ללקוח בלי מייל ובלי טלפון), ערוץ
 *             שהוגדר ידנית ללא כתובת מתאימה, מסרון שאינו דלוק בחבילה, חסימה בתקרת
 *             העלות החודשית, וספק לא כשיר (console בפרודקשן / חוסר קרדנשלס / מייל
 *             לא מוגדר). אינו כשל.
 *   failed  — כשל שליחה חולף (רשת/דחיית ספק). אין לסמן — ייעשה ניסיון חוזר.
 */
export type SendReminderResult =
  | { status: 'sent'; channel: ReminderChannel }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; channel: ReminderChannel; error: string };

/**
 * הזרקת תלויות לשכבת השליחה — מאפשרת בדיקות יחידה בלי לגעת ב-DB או בספק אמיתי.
 * ברירת המחדל מחווטת לספקים האמיתיים: sendGuardedSms (שכותב ליומן ובודק תקרה)
 * ו-sendReminderEmail; emailConfigured מאפשר לבדיקה לדמות ספק מייל מוגדר.
 */
export type SendReminderDeps = {
  sendGuardedSms?: typeof sendGuardedSms;
  sendEmail?: typeof sendReminderEmail;
  emailConfigured?: boolean;
};

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * שליחת תזכורת בערוץ המסרון (SMS) דרך נקודת האכיפה המרכזית sendGuardedSms.
 * הנקודה בודקת את תקרת העלות החודשית של העסק, שולחת בפועל דרך שכבת הספקים, ומתעדת
 * את העלות ביומן ההודעות. היעד (to) נגזר מראש ומובטח שאינו ריק.
 * מיפוי התוצאה: sent => נשלח; blocked (הגעה לתקרה) => skipped, כדי שה-cron יסמן
 * ולא ינסה שוב ללא הרף; failed => כשל חולף שיינתן לו ניסיון חוזר בריצה הבאה.
 */
async function sendViaSms(
  appt: ReminderAppointment,
  to: string,
  deps: SendReminderDeps,
): Promise<SendReminderResult> {
  const body = buildReminderBody(appt);
  const send = deps.sendGuardedSms ?? sendGuardedSms;

  try {
    const result = await send({
      businessId: appt.business.id,
      to,
      body,
      clientId: appt.client.id,
      channel: 'sms',
    });
    if (result.status === 'sent') {
      return { status: 'sent', channel: 'SMS' };
    }
    if (result.status === 'blocked') {
      return { status: 'skipped', reason: 'monthly SMS cost cap reached' };
    }
    return { status: 'failed', channel: 'SMS', error: result.error };
  } catch (err) {
    return { status: 'failed', channel: 'SMS', error: errText(err) };
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
  deps: SendReminderDeps,
): Promise<SendReminderResult> {
  const configured = deps.emailConfigured ?? emailConfigured;
  const send = deps.sendEmail ?? sendReminderEmail;
  if (!configured) {
    return { status: 'skipped', reason: 'email provider not configured' };
  }
  const { subject, text, html } = buildReminderEmail(appt);
  try {
    await send(to, subject, text, html);
    return { status: 'sent', channel: 'EMAIL' };
  } catch (err) {
    return { status: 'failed', channel: 'EMAIL', error: errText(err) };
  }
}

/**
 * שליחת הודעת תזכורת ללקוח ביעדים שנגזרו לו (resolveReminderTargets).
 * לעולם אינה זורקת חריגה — מחזירה תוצאה מובנית כדי שה-cron ירוץ על אצווה בבטחה,
 * ולעולם אינה שולחת ליעד ריק. בהעדפת BOTH של עסק אקסקלוסיב ייתכנו שני יעדים ואז
 * נשלחות שתי הודעות. אגרגציה: אם לפחות אחת נשלחה => sent (מסומן, ללא ניסיון חוזר);
 * אחרת אם לפחות אחת נכשלה => failed (ניסיון חוזר); אחרת => skipped (מסומן). יעד חסר,
 * מסרון שאינו דלוק בחבילה, או חסימת תקרה => skipped.
 */
export async function sendReminder(
  appt: ReminderAppointment,
  deps: SendReminderDeps = {},
): Promise<SendReminderResult> {
  // ה-relation settings הוא nullable; כשאין רשומה מתייחסים לברירת המחדל AUTO (כמו
  // בסכימה), כך שהיעדים נגזרים מזהות הלקוח ואף לקוח לא נשמט בגלל היעדר הגדרות.
  const channelPref = appt.business.settings?.reminderChannel ?? 'AUTO';
  // המסרון בתשלום ללקוח דלוק רק בחבילת אקסקלוסיב; בפרימיום/בסיס allowSms=false,
  // ואז היעדים נגזרים למייל בלבד או מדלגים — לעולם לא מגיע לערוץ בתשלום.
  const targets = resolveReminderTargets(appt.client, channelPref, appt.business.isExclusive);
  if (targets.length === 0) {
    // אין יעד ראוי — מדלגים עם הנימוק מהעטיפה resolveReminderChannel, כדי שה-cron
    // יסמן ולא ינסה שוב ללא הרף.
    const resolved = resolveReminderChannel(appt.client, channelPref, appt.business.isExclusive);
    const reason = resolved.kind === 'skip' ? resolved.reason : 'no reminder target resolved';
    return { status: 'skipped', reason };
  }

  // ערוץ המסרון (SMS) נשלח דרך שער העלות (sendGuardedSms); ערוץ המייל דרך email.
  let firstSent: SendReminderResult | null = null;
  let firstFailed: SendReminderResult | null = null;
  let firstSkipped: SendReminderResult | null = null;
  for (const target of targets) {
    const result =
      target.channel === 'EMAIL'
        ? await sendViaEmail(appt, target.to, deps)
        : await sendViaSms(appt, target.to, deps);
    if (result.status === 'sent') {
      if (!firstSent) firstSent = result;
    } else if (result.status === 'failed') {
      if (!firstFailed) firstFailed = result;
    } else if (!firstSkipped) {
      firstSkipped = result;
    }
  }
  if (firstSent) return firstSent;
  if (firstFailed) return firstFailed;
  return firstSkipped ?? { status: 'skipped', reason: 'no reminder target resolved' };
}
