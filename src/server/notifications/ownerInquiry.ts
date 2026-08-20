import { BRAND } from '@/config/brand';
import { contactEmail } from '@/config/contact';
import { emailConfigured, sendEmail } from '@/server/providers/email';
import {
  sendOwnerWhatsApp,
  whatsappOwnerConfigured,
} from '@/server/notifications/whatsappOwner';

/**
 * התראת בעל האתר על בקשת הצעת מחיר לשדרוג חבילה.
 *
 * עקרונות (D3):
 *  - המייל *תמיד* נשלח דרך תשתית המייל הקיימת (sendEmail), שנופלת בחן ל-console
 *    כשאין SMTP מוגדר, ולכן לעולם אינה חוסמת את הבקשה.
 *  - הוואטסאפ הוא מיטבי (best-effort) ומגודר משתני סביבה (מתאם Twilio ניתן להחלפה).
 *    כשאינו מוגדר — מדלגים בחן וממשיכים.
 *  - הפונקציה לעולם אינה זורקת: כל ערוץ עטוף ב-try/catch ומחזיר תוצאה מובנית.
 *    ההתמדה במסד קורית *לפני* הקריאה הזו, כך שדבר לא אובד גם אם כל הערוצים נכשלים.
 */

export type RequestedPlanCode = 'STANDARD' | 'PREMIUM';

export type OwnerInquiryPayload = {
  id: string;
  businessName: string;
  publicPageUrl: string;
  ownerName: string;
  email: string;
  phone: string;
  requestedPlan: RequestedPlanCode;
  createdAt: Date;
};

export type NotifyOwnerResult = {
  /** האם ניסיון שליחת המייל הושלם ללא שגיאה (כולל נפילת console בפיתוח). */
  emailed: boolean;
  /** האם הודעת הוואטסאפ נשלחה בפועל דרך Twilio. */
  whatsapped: boolean;
  /** האם ספק המייל האמיתי (SMTP) מוגדר. */
  emailConfigured: boolean;
  /** האם מתאם הוואטסאפ מוגדר במלואו. */
  whatsappConfigured: boolean;
  /** תקצירי שגיאה (אם היו) לתיעוד ב-notifyError. */
  errors: string[];
};

/** תווית עברית קריאה לחבילה המבוקשת (לגוף ההתראה). */
function planLabel(plan: RequestedPlanCode): string {
  return plan === 'PREMIUM'
    ? 'Premium · עמוד נחיתה עשיר ומלא'
    : 'Standard · עמוד עסק ומערכת קביעת תורים';
}

/** יעד המייל של בעל האתר: OWNER_NOTIFY_EMAIL, ובהיעדרו מייל הקשר של הפלטפורמה. */
export function ownerNotifyEmail(): string {
  return process.env.OWNER_NOTIFY_EMAIL?.trim() || contactEmail();
}

/** בונה נושא, גוף טקסט וגוף HTML (RTL) להתראת המייל. */
function buildEmail(payload: OwnerInquiryPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const plan = planLabel(payload.requestedPlan);
  const subject = `${BRAND.name} · בקשת הצעת מחיר חדשה · ${payload.businessName}`;

  const lines = [
    'התקבלה בקשת הצעת מחיר לשדרוג חבילה.',
    '',
    `עסק: ${payload.businessName}`,
    `חבילה מבוקשת: ${plan}`,
    `עמוד ציבורי: ${payload.publicPageUrl}`,
    `שם בעל העסק: ${payload.ownerName}`,
    `מייל לחזרה: ${payload.email}`,
    `טלפון לשיחת חזרה: ${payload.phone}`,
    `מזהה בקשה: ${payload.id}`,
    '',
    'אפשר לחזור אל בעל העסק עם הצעה ותוכנית מותאמת.',
  ];
  const text = lines.join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;white-space:nowrap">${label}</td><td style="padding:4px 0">${value}</td></tr>`;
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl;color:#0B1526">` +
    `<h2 style="color:#0A182D">בקשת הצעת מחיר חדשה</h2>` +
    `<p>התקבלה בקשת שדרוג חבילה דרך ${BRAND.name}.</p>` +
    `<table style="border-collapse:collapse;font-size:15px">` +
    row('עסק', payload.businessName) +
    row('חבילה מבוקשת', plan) +
    row(
      'עמוד ציבורי',
      `<a href="${payload.publicPageUrl}" style="color:#82643C">${payload.publicPageUrl}</a>`,
    ) +
    row('שם בעל העסק', payload.ownerName) +
    row('מייל לחזרה', `<a href="mailto:${payload.email}" style="color:#82643C">${payload.email}</a>`) +
    row('טלפון לשיחת חזרה', `<a href="tel:${payload.phone}" style="color:#82643C">${payload.phone}</a>`) +
    row('מזהה בקשה', payload.id) +
    `</table>` +
    `<p style="margin-top:16px">אפשר לחזור אל בעל העסק עם הצעה ותוכנית מותאמת.</p>` +
    `</body></html>`;

  return { subject, text, html };
}

/** בונה טקסט קצר וקריא להודעת הוואטסאפ של בעל האתר. */
function buildWhatsAppMessage(payload: OwnerInquiryPayload): string {
  return [
    `📩 ${BRAND.name} · בקשת הצעת מחיר חדשה`,
    `עסק: ${payload.businessName}`,
    `חבילה: ${planLabel(payload.requestedPlan)}`,
    `עמוד: ${payload.publicPageUrl}`,
    `בעל העסק: ${payload.ownerName}`,
    `מייל: ${payload.email}`,
    `טלפון: ${payload.phone}`,
  ].join('\n');
}

/**
 * שליחת התראת בעל האתר בשני ערוצים (מייל תמיד, וואטסאפ מיטבי). לעולם אינו זורק.
 */
export async function notifyOwnerOfInquiry(
  payload: OwnerInquiryPayload,
): Promise<NotifyOwnerResult> {
  const errors: string[] = [];
  let emailed = false;
  let whatsapped = false;

  // ── ערוץ 1: מייל לבעל האתר (חובה, תמיד מנסים) ─────────────────────────────
  try {
    const { subject, text, html } = buildEmail(payload);
    await sendEmail(ownerNotifyEmail(), subject, text, html);
    emailed = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`email: ${msg}`);
    console.error(`[inquiry:notify] email failed — ${msg}`);
  }

  // ── ערוץ 2: וואטסאפ אישי לבעל האתר (מיטבי, מגודר env) ─────────────────────
  try {
    const wa = await sendOwnerWhatsApp(buildWhatsAppMessage(payload));
    whatsapped = wa.sent;
    if (wa.error) errors.push(`whatsapp: ${wa.error}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`whatsapp: ${msg}`);
    console.error(`[inquiry:notify] whatsapp failed — ${msg}`);
  }

  return {
    emailed,
    whatsapped,
    emailConfigured,
    whatsappConfigured: whatsappOwnerConfigured(),
    errors,
  };
}
