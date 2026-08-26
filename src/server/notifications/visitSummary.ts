import { BRAND } from '@/config/brand';
import { emailConfigured, sendEmail } from '@/server/providers/email';
import { sendSms, sendWhatsApp } from '@/server/providers/messaging';

/**
 * הודעת סיכום ביקור ללקוח לאחר שהתור סומן כ"הושלם" (DONE).
 *
 * מטרה: להודות ללקוח, לציין את השירות והעסק, ולהציע קביעת תור חוזר בקליק אחד
 * דרך קישור עמוק שמכין מראש את אותו שירות (וכשאפשר גם את אותו איש צוות).
 *
 * עקרונות (זהים לשכבת ההתראה על אישור התור):
 *  - מייל נשלח ללקוח כאשר יש לו כתובת מייל, דרך תשתית המייל הקיימת (sendEmail),
 *    שנופלת בחן ל-console כשאין SMTP ולכן לעולם אינה חוסמת את סימון ההשלמה.
 *  - הודעת טקסט (WhatsApp, ובנפילה SMS) נשלחת רק בעסקי פרימיום ורק כשיש טלפון,
 *    מפני שערוצי ההודעות בתשלום. בבסיס נשלח מייל בלבד.
 *  - הפונקציה לעולם אינה זורקת: כל ערוץ עטוף ב-try/catch ומחזיר תוצאה מובנית.
 *    סימון ההשלמה וההתמדה קורים *לפני* הקריאה הזו, כך שדבר לא אובד גם אם ההודעה נכשלת.
 */

/** שירות בודד בגוף ההודעה (פרימיטיבים בלבד — עצמאי מטיפוסי Prisma לבדיקות קלות). */
export type VisitSummaryService = {
  name: string;
};

export type VisitSummaryPayload = {
  /** מזהה התור שהושלם. */
  appointmentId: string;
  /** שם העסק (לכותרת ולגוף). */
  businessName: string;
  /** שם הלקוח. */
  clientName: string;
  /** מייל הלקוח (אם קיים) — יעד המייל. */
  clientEmail?: string | null;
  /** טלפון הלקוח (אם קיים) — יעד ההודעה בפרימיום. */
  clientPhone?: string | null;
  /** השירות/ים שניתנו בביקור. */
  services: VisitSummaryService[];
  /** כתובת מוחלטת לקביעת תור חוזר (קישור עמוק עם השירות ואיש הצוות מוכנים מראש). */
  rebookUrl: string;
  /** האם העסק בפרימיום פעיל — שער לערוצי ההודעות בתשלום. */
  isPremium: boolean;
};

export type NotifyVisitSummaryResult = {
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

/** הכיתוב הקבוע של הקריאה לפעולה — קביעת תור חוזר בקליק אחד. */
const REBOOK_CTA = 'לקביעת תור חוזר';

/** בונה נושא, גוף טקסט וגוף HTML (RTL) להודעת סיכום הביקור. */
export function buildVisitSummaryEmail(payload: VisitSummaryPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const serviceNames = payload.services.map((s) => s.name).join(', ');

  const subject = `${BRAND.name} · תודה על הביקור · ${payload.businessName}`;

  const lines = [
    `שלום ${payload.clientName},`,
    '',
    `תודה שביקרת ב${payload.businessName}.`,
    ...(serviceNames ? [`הטיפול שקיבלת: ${serviceNames}.`] : []),
    '',
    `רוצה לחזור? ${REBOOK_CTA} בקליק אחד: ${payload.rebookUrl}`,
  ];
  const text = lines.join('\n');

  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl;color:#0B1526">` +
    `<h2 style="color:#0A182D">תודה על הביקור</h2>` +
    `<p>שלום ${payload.clientName}, תודה שביקרת ב${payload.businessName} דרך ${BRAND.name}.</p>` +
    (serviceNames
      ? `<p style="font-size:15px">הטיפול שקיבלת: <strong>${serviceNames}</strong>.</p>`
      : '') +
    `<p style="margin-top:20px">` +
    `<a href="${payload.rebookUrl}" style="display:inline-block;background:#82643C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:bold;font-size:16px">${REBOOK_CTA}</a>` +
    `</p>` +
    `</body></html>`;

  return { subject, text, html };
}

/** נוסח הודעת הטקסט הקצרה (WhatsApp/SMS) עם הקישור לקביעת תור חוזר. */
export function buildVisitSummaryMessage(payload: VisitSummaryPayload): string {
  const serviceNames = payload.services.map((s) => s.name).join(', ');
  const service = serviceNames ? ` (${serviceNames})` : '';
  return `${BRAND.name}: שלום ${payload.clientName}, תודה על הביקור ב${payload.businessName}${service}. ${REBOOK_CTA}: ${payload.rebookUrl}`;
}

/**
 * שליחת הודעת סיכום הביקור ללקוח. לעולם אינו זורק.
 * מייל בכל החבילות (כשיש מייל); WhatsApp/SMS רק בפרימיום (כשיש טלפון).
 */
export async function notifyClientOfVisitSummary(
  payload: VisitSummaryPayload,
): Promise<NotifyVisitSummaryResult> {
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
      const { subject, text, html } = buildVisitSummaryEmail(payload);
      await sendEmail(email, subject, text, html);
      emailed = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`email: ${msg}`);
      console.error(`[summary:notify] email failed — ${msg}`);
    }
  }

  // ── ערוץ 2: הודעת טקסט — פרימיום בלבד (ערוץ בתשלום), כשיש טלפון ──────────
  if (payload.isPremium && phone) {
    const message = buildVisitSummaryMessage(payload);
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
        console.error(`[summary:notify] message failed — whatsapp: ${waMsg}; sms: ${smsMsg}`);
      }
    }
  }

  return { emailed, messaged, messageChannel, emailSkipped, emailConfigured, errors };
}
