import { BRAND } from '@/config/brand';
import { emailConfigured, sendEmail } from '@/server/providers/email';
import { sendGuardedSms } from '@/server/billing/costGuard';
import { formatDateString, formatLongDate, formatTime } from '@/lib/time';
import { renderMessage } from '@/server/messages/render';

/**
 * התראת הלקוח על אישור התור על ידי בעל העסק (מעבר PENDING → CONFIRMED).
 *
 * עקרונות:
 *  - מייל נשלח ללקוח בפרימיום/אקסקלוסיב כאשר יש לו כתובת מייל, דרך תשתית המייל הקיימת
 *    (sendEmail), שנופלת בחן ל-console כשאין SMTP ולכן לעולם אינה חוסמת את האישור.
 *  - מסרון בתשלום נשלח רק בעסקי אקסקלוסיב ורק כשיש טלפון, ותמיד דרך שער העלות
 *    המרכזי (sendGuardedSms), כך שהוא נספר אל מול התקרה החודשית ונחסם בהגעה אליה.
 *    בסטנדרט אין ערוצי תקשורת ללקוח כלל, ווואטסאפ אינו בשימוש באיטרציה זו.
 *  - הפונקציה לעולם אינה זורקת: כל ערוץ עטוף ב-try/catch ומחזיר תוצאה מובנית.
 *    אישור התור וההתמדה קורים *לפני* הקריאה הזו, כך שדבר לא אובד גם אם ההתראה נכשלת.
 */

/** שירות בודד בגוף ההתראה (פרימיטיבים בלבד — עצמאי מטיפוסי Prisma לבדיקות קלות). */
export type ClientApprovalService = {
  name: string;
};

export type ClientApprovalPayload = {
  /** מזהה התור שאושר. */
  appointmentId: string;
  /** מזהה העסק — נדרש לשער העלות ולתיעוד ביומן ההודעות. */
  businessId: string;
  /** שם העסק (לכותרת ולגוף). */
  businessName: string;
  /** מזהה הלקוח (אם קיים) — לתיעוד ביומן ההודעות. */
  clientId?: string | null;
  /** שם הלקוח. */
  clientName: string;
  /** מייל הלקוח (אם קיים) — יעד המייל. */
  clientEmail?: string | null;
  /** טלפון הלקוח (אם קיים) — יעד המסרון באקסקלוסיב. */
  clientPhone?: string | null;
  /** השירות/ים שנקבעו. */
  services: ClientApprovalService[];
  /** תחילת התור (רגע UTC). */
  startAt: Date;
  /** אזור הזמן של העסק (לעיצוב תאריך/שעה). */
  timezone: string;
  /** האם העסק שולח מיילים ללקוח (פרימיום/אקסקלוסיב) — שער ערוץ המייל. */
  canEmail: boolean;
  /** האם העסק באקסקלוסיב פעיל — שער למסרון בתשלום ללקוח. */
  isExclusive: boolean;
  /** קישור מוחלט לעמוד העסק/התור (אופציונלי). */
  manageUrl?: string | null;
};

/** הזרקת תלות לבדיקות — עוקפת את שער העלות האמיתי (שכותב ל-DB). */
export type NotifyClientApprovalDeps = {
  sendGuardedSms?: typeof sendGuardedSms;
};

export type NotifyClientApprovalResult = {
  /** האם ניסיון שליחת המייל הושלם ללא שגיאה (כולל נפילת console בפיתוח). */
  emailed: boolean;
  /** האם נשלח מסרון בתשלום דרך שער העלות. */
  messaged: boolean;
  /** ערוץ ההודעה שנמסר בפועל, אם היה. */
  messageChannel: 'sms' | null;
  /** האם דילגנו על המייל מפני שאין ללקוח כתובת מייל. */
  emailSkipped: boolean;
  /** האם ספק המייל האמיתי (SMTP) מוגדר. */
  emailConfigured: boolean;
  /** תקצירי שגיאה (אם היו) לתיעוד. */
  errors: string[];
};

/** מנסח את משפט "התור אושר" לכל הערוצים. */
function buildWhen(payload: ClientApprovalPayload): string {
  const dateStr = formatDateString(payload.startAt, payload.timezone);
  const longDate = formatLongDate(dateStr, payload.timezone);
  const time = formatTime(payload.startAt, payload.timezone);
  return `${longDate} · ${time}`;
}

/** בונה נושא, גוף טקסט וגוף HTML (RTL) להתראת אישור התור. */
export function buildApprovalEmail(payload: ClientApprovalPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const when = buildWhen(payload);
  const serviceNames = payload.services.map((s) => s.name).join(', ');

  const subject = `${BRAND.name} · התור שלך אושר · ${payload.businessName}`;

  const lines = [
    `שלום ${payload.clientName},`,
    '',
    `התור שלך בעסק ${payload.businessName} אושר.`,
    '',
    ...(serviceNames ? [`שירות/ים: ${serviceNames}`] : []),
    `מועד: ${when}`,
    ...(payload.manageUrl ? ['', `פרטי העסק: ${payload.manageUrl}`] : []),
  ];
  const text = lines.join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;white-space:nowrap">${label}</td><td style="padding:4px 0">${value}</td></tr>`;
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl;color:#0B1526">` +
    `<h2 style="color:#0A182D">התור שלך אושר</h2>` +
    `<p>שלום ${payload.clientName}, התור שלך בעסק ${payload.businessName} אושר דרך ${BRAND.name}.</p>` +
    `<table style="border-collapse:collapse;font-size:15px">` +
    (serviceNames ? row('שירות/ים', serviceNames) : '') +
    row('מועד', when) +
    `</table>` +
    (payload.manageUrl
      ? `<p style="margin-top:16px"><a href="${payload.manageUrl}" style="color:#82643C">מעבר לעמוד העסק</a></p>`
      : '') +
    `</body></html>`;

  return { subject, text, html };
}

/** נוסח הודעת הטקסט הקצרה (SMS) על אישור התור. */
export function buildApprovalMessage(payload: ClientApprovalPayload): string {
  const when = buildWhen(payload);
  return `${BRAND.name}: שלום ${payload.clientName}, התור שלך בעסק ${payload.businessName} אושר. מועד: ${when}.`;
}

/**
 * שליחת התראת אישור התור ללקוח. לעולם אינו זורק.
 * מייל בפרימיום/אקסקלוסיב (כשיש מייל); מסרון בתשלום רק באקסקלוסיב (כשיש טלפון), דרך שער העלות.
 * בסטנדרט אין ערוצי תקשורת ללקוח ולכן לא נשלחת התראה.
 */
export async function notifyClientOfApproval(
  payload: ClientApprovalPayload,
  deps: NotifyClientApprovalDeps = {},
): Promise<NotifyClientApprovalResult> {
  const errors: string[] = [];
  let emailed = false;
  let emailSkipped = false;
  let messaged = false;
  let messageChannel: 'sms' | null = null;

  const email = payload.clientEmail?.trim() || null;
  const phone = payload.clientPhone?.trim() || null;

  // משתני התבנית לנתיב הדריסה (מחושבים פעם אחת; משמשים רק כשקיימת דריסת-בעלים).
  const dateStr = formatDateString(payload.startAt, payload.timezone);
  const vars = {
    clientName: payload.clientName,
    businessName: payload.businessName,
    date: formatLongDate(dateStr, payload.timezone),
    time: formatTime(payload.startAt, payload.timezone),
    manageUrl: payload.manageUrl ?? '',
    brand: BRAND.name,
  };

  // ── ערוץ 1: מייל ללקוח (פרימיום/אקסקלוסיב בלבד, כשיש כתובת) ───────────────
  if (!payload.canEmail || !email) {
    emailSkipped = true;
  } else {
    try {
      const fb = buildApprovalEmail(payload);
      const { subject, text, html } = await renderMessage(
        payload.businessId,
        'booking_approval',
        'email',
        vars,
        fb,
      );
      await sendEmail(email, subject ?? fb.subject, text, html);
      emailed = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`email: ${msg}`);
      console.error(`[approval:notify] email failed — ${msg}`);
    }
  }

  // ── ערוץ 2: מסרון בתשלום — אקסקלוסיב בלבד, דרך שער העלות, כשיש טלפון ───────
  if (payload.isExclusive && phone) {
    const { text: message } = await renderMessage(
      payload.businessId,
      'booking_approval',
      'sms',
      vars,
      { text: buildApprovalMessage(payload) },
    );
    const guardedSend = deps.sendGuardedSms ?? sendGuardedSms;
    try {
      const res = await guardedSend({
        businessId: payload.businessId,
        to: phone,
        body: message,
        clientId: payload.clientId ?? null,
        channel: 'sms',
      });
      if (res.status === 'sent') {
        messaged = true;
        messageChannel = 'sms';
      } else if (res.status === 'blocked') {
        errors.push('sms: cost_cap_exceeded');
      } else {
        errors.push(`sms: ${res.error}`);
      }
    } catch (smsErr) {
      const smsMsg = smsErr instanceof Error ? smsErr.message : String(smsErr);
      errors.push(`sms: ${smsMsg}`);
      console.error(`[approval:notify] sms failed — ${smsMsg}`);
    }
  }

  return { emailed, messaged, messageChannel, emailSkipped, emailConfigured, errors };
}
