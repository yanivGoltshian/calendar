import { emailConfigured, sendReminderEmail } from '@/server/providers/email';
import {
  resolveReminderChannel,
  resolveReminderTargets,
} from '@/server/reminders/resolveChannel';
import { sendGuardedSms } from '@/server/billing/costGuard';
import { t } from '@/i18n';
import { BRAND } from '@/config/brand';
import { absoluteUrl } from '@/lib/seo';
import { DEFAULT_TZ, formatDateString, formatLongDate, formatTime } from '@/lib/time';
import { renderMessage } from '@/server/messages/render';
import { canDeliverClientEmail } from '@/server/billing/deliveryPolicy';
import { deliverEmailOnce } from '@/server/billing/emailDelivery';

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

/** Skips/preparation failures remain unsent and retryable. Only ambiguous
 * dispatch outcomes require quarantine rather than automatic retry. */
export type SendReminderResult =
  | { status: 'sent'; channel: ReminderChannel; duplicate?: boolean }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; channel: ReminderChannel; error: string; deliveredChannels?: ReminderChannel[] };
export type PreparedReminder = () => Promise<SendReminderResult>;
const preparedResult = (result: SendReminderResult): PreparedReminder => async () => result;

/**
 * הזרקת תלויות לשכבת השליחה — מאפשרת בדיקות יחידה בלי לגעת ב-DB או בספק אמיתי.
 * ברירת המחדל מחווטת לספקים האמיתיים: sendGuardedSms (שכותב ליומן ובודק תקרה)
 * ו-sendReminderEmail; emailConfigured מאפשר לבדיקה לדמות ספק מייל מוגדר.
 */
export type SendReminderDeps = {
  sendGuardedSms?: typeof sendGuardedSms;
  sendEmail?: typeof sendReminderEmail;
  deliverEmail?: typeof deliverEmailOnce;
  canDeliverEmail?: typeof canDeliverClientEmail;
  emailConfigured?: boolean;
};

export class ReminderPreparationError extends Error {
  constructor() {
    super('preparation_failed');
    this.name = 'ReminderPreparationError';
  }
}

/**
 * משתני התבנית לנתיב הדריסה של הבעלים (מחושבים רק כשצריך; משמשים כשקיימת דריסה).
 * manageUrl = קישור האישור /c/<token> כשהאישור דלוק (ברירת מחדל), אחרת ריק.
 */
function reminderVars(appt: ReminderAppointment): Record<string, string> {
  const tz = appt.business.timezone || DEFAULT_TZ;
  const dateStr = formatDateString(appt.startAt, tz);
  const confirmationRequired = appt.business.settings?.confirmationRequired ?? true;
  return {
    businessName: appt.business.name,
    date: formatLongDate(dateStr, tz),
    time: formatTime(appt.startAt, tz),
    manageUrl: confirmationRequired ? absoluteUrl(`/c/${appt.confirmToken}`) : '',
    brand: BRAND.name,
  };
}

async function prepareViaSms(
  appt: ReminderAppointment,
  to: string,
  deps: SendReminderDeps,
): Promise<PreparedReminder> {
  const { text: body } = await renderMessage(
    appt.business.id,
    'reminder',
    'sms',
    reminderVars(appt),
    { text: buildReminderBody(appt) },
  );
  const send = deps.sendGuardedSms ?? sendGuardedSms;

  return async () => {
    try {
      const result = await send({
        businessId: appt.business.id,
        to,
        body,
        clientId: appt.client.id,
        channel: 'sms',
        appointmentId: appt.id,
        idempotencyKey: `reminder:${appt.id}:sms`,
      });
      if (result.status === 'sent') {
        return { status: 'sent', channel: 'SMS', ...(result.duplicate ? { duplicate: true } : {}) };
      }
      if (result.status === 'blocked') {
        if (result.reason === 'delivery_outcome_unknown') {
          return { status: 'failed', channel: 'SMS', error: 'delivery_outcome_unknown' };
        }
        return { status: 'skipped', reason: result.reason ?? 'monthly SMS cost cap reached' };
      }
      return { status: 'failed', channel: 'SMS', error: result.error };
    } catch {
      // The guarded boundary reports provider uncertainty as a result; an escaped
      // exception is from preparation/reservation, before a provider is invoked.
      return { status: 'failed', channel: 'SMS', error: 'preparation_failed' };
    }
  };
}

/**
 * שליחת תזכורת בערוץ המייל דרך src/server/providers/email.
 * אם ספק המייל אינו מוגדר — מדלגים בחן (skipped) במקום לדווח "נשלח" על נפילת console.
 * היעד (to) נגזר מראש ומובטח שאינו ריק.
 */
async function prepareViaEmail(
  appt: ReminderAppointment,
  to: string,
  deps: SendReminderDeps,
): Promise<PreparedReminder> {
  const configured = deps.emailConfigured ?? emailConfigured;
  const send = deps.sendEmail ?? sendReminderEmail;
  if (!configured) {
    return preparedResult({ status: 'skipped', reason: 'email provider not configured' });
  }
  if ((deps.canDeliverEmail || !deps.sendEmail) &&
      !await (deps.canDeliverEmail ?? canDeliverClientEmail)(appt.business.id, appt.id)) {
    return preparedResult({ status: 'skipped', reason: 'email_entitlement_denied' });
  }
  const fb = buildReminderEmail(appt);
  const { subject, text, html } = await renderMessage(
    appt.business.id,
    'reminder',
    'email',
    reminderVars(appt),
    fb,
  );
  return async () => {
    try {
      if (!deps.sendEmail) {
        const result = await (deps.deliverEmail ?? deliverEmailOnce)({
          businessId: appt.business.id, appointmentId: appt.id, clientId: appt.client.id,
          idempotencyKey: `reminder:${appt.id}:email`,
          to, subject: subject ?? fb.subject, text, html: html ?? fb.html,
        });
        if (result.status === 'sent') return { status: 'sent', channel: 'EMAIL', ...(result.duplicate ? { duplicate: true } : {}) };
        if (result.status === 'blocked') return { status: 'skipped', reason: result.reason };
        return { status: 'failed', channel: 'EMAIL', error: result.status === 'unknown' ? 'delivery_outcome_unknown' : result.reason };
      }
      await send(to, subject ?? fb.subject, text, html ?? fb.html);
      return { status: 'sent', channel: 'EMAIL' };
    } catch (err) {
      if (!deps.sendEmail) {
        // deliverEmailOnce catches provider/acceptance failures itself. Its
        // unhandled DB errors precede provider dispatch and are safe to retry.
        return { status: 'failed', channel: 'EMAIL', error: 'preparation_failed' };
      }
      const rejected = ['EAUTH', 'EENVELOPE', 'ECONNECTION', 'ECONNREFUSED', 'ENOTFOUND'].includes((err as NodeJS.ErrnoException)?.code ?? '');
      return { status: 'failed', channel: 'EMAIL', error: rejected ? 'provider_rejected' : 'delivery_outcome_unknown' };
    }
  };
}

/** Prepare without provider side effects; the returned function is the dispatch
 * boundary. Preparation may throw. Dispatch returns per-channel delivery state. */
export async function prepareReminder(
  appt: ReminderAppointment,
  deps: SendReminderDeps = {},
): Promise<PreparedReminder> {
  // ה-relation settings הוא nullable; כשאין רשומה מתייחסים לברירת המחדל AUTO (כמו
  // בסכימה), כך שהיעדים נגזרים מזהות הלקוח ואף לקוח לא נשמט בגלל היעדר הגדרות.
  const channelPref = appt.business.settings?.reminderChannel ?? 'AUTO';
  // המסרון בתשלום ללקוח דלוק רק בחבילת אקסקלוסיב; בפרימיום/בסיס allowSms=false,
  // ואז היעדים נגזרים למייל בלבד או מדלגים — לעולם לא מגיע לערוץ בתשלום.
  const targets = resolveReminderTargets(appt.client, channelPref, appt.business.isExclusive);
  if (targets.length === 0) {
    const resolved = resolveReminderChannel(appt.client, channelPref, appt.business.isExclusive);
    const reason = resolved.kind === 'skip' ? resolved.reason : 'no reminder target resolved';
    return preparedResult({ status: 'skipped', reason });
  }

  // Finish every channel's eligibility check and rendering before any channel
  // may dispatch; a preparation failure cannot hide an already accepted send.
  const prepared: PreparedReminder[] = [];
  for (const target of targets) {
    prepared.push(await (target.channel === 'EMAIL'
      ? prepareViaEmail(appt, target.to, deps)
      : prepareViaSms(appt, target.to, deps)));
  }
  return async () => {
    // ערוץ המסרון (SMS) נשלח דרך שער העלות (sendGuardedSms); ערוץ המייל דרך email.
    let firstSent: SendReminderResult | null = null;
    let firstFailed: SendReminderResult | null = null;
    let firstSkipped: SendReminderResult | null = null;
    const deliveredChannels: ReminderChannel[] = [];
    for (const dispatch of prepared) {
      const result = await dispatch();
      if (result.status === 'sent') {
        if (!firstSent) firstSent = result;
        if (!result.duplicate) deliveredChannels.push(result.channel);
      } else if (result.status === 'failed') {
        if (!firstFailed || result.error === 'delivery_outcome_unknown') firstFailed = result;
      } else if (!firstSkipped) {
        firstSkipped = result;
      }
    }
    if (firstFailed) return { ...firstFailed, ...(deliveredChannels.length ? { deliveredChannels } : {}) };
    if (firstSent) {
      return { status: 'sent', channel: firstSent.channel, ...(!deliveredChannels.length ? { duplicate: true } : {}) };
    }
    return firstSkipped ?? { status: 'skipped', reason: 'no reminder target resolved' };
  };
}

export async function sendReminder(
  appt: ReminderAppointment,
  deps: SendReminderDeps = {},
): Promise<SendReminderResult> {
  let dispatch: PreparedReminder;
  try {
    dispatch = await prepareReminder(appt, deps);
  } catch {
    throw new ReminderPreparationError();
  }
  return dispatch();
}
