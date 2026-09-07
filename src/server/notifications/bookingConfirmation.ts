import { BRAND } from '@/config/brand';
import { sendGuardedSms } from '@/server/billing/costGuard';
import { formatDateString, formatLongDate, formatTime } from '@/lib/time';
import { escapeHtml, renderMessage } from '@/server/messages/render';
import { safeMessageLink } from '@/server/messages/safeLink';
import { deliverEmailOnce } from '@/server/billing/emailDelivery';

/**
 * אישור הזמנה מיידי ללקוח כאשר התור נקבע ואושר על המקום (CONFIRMED ללא אישור עסק).
 *
 * שער לפי מסלול (tier), מקור אמת יחיד ב-src/server/tier.ts:
 *  - סטנדרט (basic): אין ערוצי תקשורת ללקוח. הפונקציה אינה נקראת (canEmail=canWhatsapp=false),
 *    ואם כן נקראה — אינה שולחת דבר.
 *  - פרימיום: מייל אישור הזמנה (כשיש כתובת מייל).
 *  - אקסקלוסיב: מייל אישור, ובנוסף הודעת וואטסאפ (כשיש טלפון). ערוץ הוואטסאפ נתיק
 *    (pluggable) דרך ספק ההודעות; החיווט הקונקרטי (Azure ACS) נשלט בסשן ייעודי.
 *
 * הפונקציה לעולם אינה זורקת: כל ערוץ עטוף ב-try/catch. ההזמנה כבר נוצרה והוחזרה בהצלחה
 * לפני הקריאה, ולכן כשל התראה אינו משפיע על תוצאת ההזמנה.
 */

export type BookingConfirmationService = { name: string };

export type BookingConfirmationPayload = {
  appointmentId: string;
  businessName: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  services: BookingConfirmationService[];
  startAt: Date;
  timezone: string;
  /** מזהה העסק, לטעינת דריסת-תבנית של הבעלים (אופציונלי; ללא ערך → ברירת מחדל). */
  businessId?: string | null;
  /** האם לשלוח מייל אישור (פרימיום/אקסקלוסיב). */
  canEmail: boolean;
  /** האם לשלוח וואטסאפ אישור (אקסקלוסיב). */
  canWhatsapp: boolean;
  manageUrl?: string | null;
  /** טלפון העסק לחתימת המייל (אופציונלי). */
  businessPhone?: string | null;
  /** כתובת העסק לחתימת המייל (אופציונלי). */
  businessAddress?: string | null;
};

export type BookingConfirmationResult = {
  emailed: boolean;
  messaged: boolean;
  messageChannel: 'whatsapp' | null;
  errors: string[];
};

function buildWhen(payload: BookingConfirmationPayload): string {
  const dateStr = formatDateString(payload.startAt, payload.timezone);
  const longDate = formatLongDate(dateStr, payload.timezone);
  const time = formatTime(payload.startAt, payload.timezone);
  return `${longDate} · ${time}`;
}

/** נושא, גוף טקסט וגוף HTML (RTL) לאישור ההזמנה. */
export function buildConfirmationEmail(payload: BookingConfirmationPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const when = buildWhen(payload);
  const manageUrl = safeMessageLink(payload.manageUrl);
  const serviceNames = payload.services.map((s) => s.name).join(', ');
  const subject = `${BRAND.name} · אישור הזמנה · ${payload.businessName}`;

  const lines = [
    `שלום ${payload.clientName},`,
    '',
    `שמחים לאשר שהתור שלך ב${payload.businessName} נקבע בהצלחה. אנחנו כבר מצפים לראותך.`,
    '',
    ...(serviceNames ? [`שירות/ים: ${serviceNames}`] : []),
    `מועד: ${when}`,
    ...(manageUrl ? ['', `לצפייה בפרטי התור או לביטול: ${manageUrl}`, 'לשינוי המועד יש לבטל את התור ולהזמין תור חדש, בכפוף לזמינות ולמדיניות הביטול.'] : []),
    '',
    `נשמח לעמוד לרשותך לכל שאלה,`,
    `צוות ${payload.businessName}`,
    ...(payload.businessPhone ? [`טלפון: ${payload.businessPhone}`] : []),
    ...(payload.businessAddress ? [`כתובת: ${payload.businessAddress}`] : []),
  ];
  const text = lines.join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`;
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl;color:#0B1526">` +
    `<h2 style="color:#0A182D">אישור הזמנה</h2>` +
    `<p>שלום ${escapeHtml(payload.clientName)}, שמחים לאשר שהתור שלך ב${escapeHtml(payload.businessName)} נקבע בהצלחה. אנחנו כבר מצפים לראותך.</p>` +
    `<table style="border-collapse:collapse;font-size:15px">` +
    (serviceNames ? row('שירות/ים', serviceNames) : '') +
    row('מועד', when) +
    `</table>` +
    (manageUrl
      ? `<p style="margin-top:16px"><a href="${escapeHtml(manageUrl)}" style="color:#82643C">לצפייה בפרטי התור או לביטול</a><br>לשינוי המועד יש לבטל את התור ולהזמין תור חדש, בכפוף לזמינות ולמדיניות הביטול.</p>`
      : '') +
    `<p style="margin-top:16px">נשמח לעמוד לרשותך לכל שאלה,<br>צוות ${escapeHtml(payload.businessName)}` +
    (payload.businessPhone ? `<br>טלפון: ${escapeHtml(payload.businessPhone)}` : '') +
    (payload.businessAddress ? `<br>כתובת: ${escapeHtml(payload.businessAddress)}` : '') +
    `</p>` +
    `</body></html>`;

  return { subject, text, html };
}

/** נוסח הודעת הוואטסאפ הקצרה לאישור ההזמנה. */
export function buildConfirmationMessage(payload: BookingConfirmationPayload): string {
  const when = buildWhen(payload);
  return `${BRAND.name}: שלום ${payload.clientName}, התור שלך ב${payload.businessName} נקבע בהצלחה למועד ${when}. נשמח לראותך!`;
}

/**
 * שליחת אישור ההזמנה ללקוח לפי הרשאות המסלול. לעולם אינו זורק.
 */
export async function notifyClientOfBooking(
  payload: BookingConfirmationPayload,
  deps: { deliverEmail?: typeof deliverEmailOnce; sendGuardedSms?: typeof sendGuardedSms } = {},
): Promise<BookingConfirmationResult> {
  const errors: string[] = [];
  let emailed = false;
  let messaged = false;
  let messageChannel: 'whatsapp' | null = null;

  const email = payload.clientEmail?.trim() || null;
  const phone = payload.clientPhone?.trim() || null;

  // משתני התבנית לנתיב הדריסה (מחושבים פעם אחת; משמשים רק כשקיימת דריסת-בעלים).
  const dateStr = formatDateString(payload.startAt, payload.timezone);
  const vars = {
    clientName: payload.clientName,
    businessName: payload.businessName,
    services: payload.services.map((s) => s.name).join(', '),
    date: formatLongDate(dateStr, payload.timezone),
    time: formatTime(payload.startAt, payload.timezone),
    manageUrl: safeMessageLink(payload.manageUrl) ?? '',
    businessPhone: payload.businessPhone ?? '',
    businessAddress: payload.businessAddress ?? '',
    brand: BRAND.name,
  };

  // ── ערוץ 1: מייל אישור (פרימיום/אקסקלוסיב, כשיש כתובת) ────────────────────
  if (payload.canEmail && email) {
    try {
      if (!payload.businessId) throw new Error('missing_business');
      const fb = buildConfirmationEmail(payload);
      const { subject, text, html } = await renderMessage(
        payload.businessId,
        'booking_confirmation',
        'email',
        vars,
        fb,
      );
      const result = await (deps.deliverEmail ?? deliverEmailOnce)({
        businessId: payload.businessId, appointmentId: payload.appointmentId,
        idempotencyKey: `booking-confirmation:${payload.appointmentId}`,
        to: email, subject: subject ?? fb.subject, text, html,
      });
      emailed = result.status === 'sent';
      if (result.status !== 'sent') errors.push(`email: ${result.reason}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`email: ${msg}`);
      console.error(`[booking:confirm] email failed — ${msg}`);
    }
  }

  // ── ערוץ 2: וואטסאפ אישור (אקסקלוסיב, כשיש טלפון) ────────────────────────
  // ערוץ נתיק: ספק ההודעות עשוי להיות stub המדפיס ללוג עד לחיווט Azure ACS.
  if (payload.canWhatsapp && phone) {
    try {
      const { text } = await renderMessage(
        payload.businessId,
        'booking_confirmation',
        'sms',
        vars,
        { text: buildConfirmationMessage(payload) },
      );
      if (!payload.businessId) throw new Error('missing_business');
      const delivered = await (deps.sendGuardedSms ?? sendGuardedSms)({
        businessId: payload.businessId,
        appointmentId: payload.appointmentId,
        idempotencyKey: `booking-confirmation:${payload.appointmentId}`,
        to: phone,
        body: text,
        channel: 'whatsapp',
      });
      if (delivered.status === 'sent') {
        messaged = true;
        messageChannel = 'whatsapp';
      } else {
        errors.push(`whatsapp: ${delivered.status === 'blocked' ? delivered.reason : delivered.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`whatsapp: ${msg}`);
      console.error(`[booking:confirm] whatsapp failed — ${msg}`);
    }
  }

  return { emailed, messaged, messageChannel, errors };
}
