import { BRAND } from '@/config/brand';
import { emailConfigured, sendEmail } from '@/server/providers/email';
import { sendSms, sendWhatsApp } from '@/server/providers/messaging';
import { formatDateString, formatLongDate, formatTime } from '@/lib/time';

/**
 * התראת הלקוח על אישור התור על ידי בעל העסק (מעבר PENDING → CONFIRMED).
 *
 * עקרונות:
 *  - מייל נשלח ללקוח כאשר יש לו כתובת מייל, דרך תשתית המייל הקיימת (sendEmail),
 *    שנופלת בחן ל-console כשאין SMTP ולכן לעולם אינה חוסמת את האישור.
 *  - הודעת טקסט (WhatsApp, ובנפילה SMS) נשלחת רק בעסקי פרימיום ורק כשיש טלפון,
 *    מפני שערוצי ההודעות בתשלום. בבסיס נשלח מייל בלבד.
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
  /** שם העסק (לכותרת ולגוף). */
  businessName: string;
  /** שם הלקוח. */
  clientName: string;
  /** מייל הלקוח (אם קיים) — יעד המייל. */
  clientEmail?: string | null;
  /** טלפון הלקוח (אם קיים) — יעד ההודעה בפרימיום. */
  clientPhone?: string | null;
  /** השירות/ים שנקבעו. */
  services: ClientApprovalService[];
  /** תחילת התור (רגע UTC). */
  startAt: Date;
  /** אזור הזמן של העסק (לעיצוב תאריך/שעה). */
  timezone: string;
  /** האם העסק בפרימיום פעיל — שער לערוצי ההודעות בתשלום. */
  isPremium: boolean;
  /** קישור מוחלט לעמוד העסק/התור (אופציונלי). */
  manageUrl?: string | null;
};

export type NotifyClientApprovalResult = {
  /** האם ניסיון שליחת המייל הושלם ללא שגיאה (כולל נפילת console בפיתוח). */
  emailed: boolean;
  /** האם נשלחה הודעת טקסט (WhatsApp/SMS). */
  messaged: boolean;
  /** ערוץ ההודעה שנמסר בפועל, אם היה. */
  messageChannel: 'whatsapp' | 'sms' | null;
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

/** נוסח הודעת הטקסט הקצרה (WhatsApp/SMS) על אישור התור. */
export function buildApprovalMessage(payload: ClientApprovalPayload): string {
  const when = buildWhen(payload);
  return `${BRAND.name}: שלום ${payload.clientName}, התור שלך בעסק ${payload.businessName} אושר. מועד: ${when}.`;
}

/**
 * שליחת התראת אישור התור ללקוח. לעולם אינו זורק.
 * מייל בכל החבילות (כשיש מייל); WhatsApp/SMS רק בפרימיום (כשיש טלפון).
 */
export async function notifyClientOfApproval(
  payload: ClientApprovalPayload,
): Promise<NotifyClientApprovalResult> {
  const errors: string[] = [];
  let emailed = false;
  let emailSkipped = false;
  let messaged = false;
  let messageChannel: 'whatsapp' | 'sms' | null = null;

  const email = payload.clientEmail?.trim() || null;
  const phone = payload.clientPhone?.trim() || null;

  // ── ערוץ 1: מייל ללקוח (בכל החבילות, כשיש כתובת) ─────────────────────────
  if (!email) {
    emailSkipped = true;
  } else {
    try {
      const { subject, text, html } = buildApprovalEmail(payload);
      await sendEmail(email, subject, text, html);
      emailed = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`email: ${msg}`);
      console.error(`[approval:notify] email failed — ${msg}`);
    }
  }

  // ── ערוץ 2: הודעת טקסט — פרימיום בלבד (ערוץ בתשלום), כשיש טלפון ──────────
  if (payload.isPremium && phone) {
    const message = buildApprovalMessage(payload);
    try {
      await sendWhatsApp(phone, message);
      messaged = true;
      messageChannel = 'whatsapp';
    } catch (waErr) {
      const waMsg = waErr instanceof Error ? waErr.message : String(waErr);
      // נפילה בחן ל-SMS אם WhatsApp נכשל.
      try {
        await sendSms(phone, message);
        messaged = true;
        messageChannel = 'sms';
      } catch (smsErr) {
        const smsMsg = smsErr instanceof Error ? smsErr.message : String(smsErr);
        errors.push(`whatsapp: ${waMsg}`);
        errors.push(`sms: ${smsMsg}`);
        console.error(`[approval:notify] message failed — whatsapp: ${waMsg}; sms: ${smsMsg}`);
      }
    }
  }

  return { emailed, messaged, messageChannel, emailSkipped, emailConfigured, errors };
}
