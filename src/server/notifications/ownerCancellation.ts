import { BRAND } from '@/config/brand';
import { emailConfigured, sendEmail } from '@/server/providers/email';
import { getPushProvider } from '@/server/providers/push';
import { formatDateString, formatLongDate, formatTime } from '@/lib/time';

/**
 * התראת בעל העסק על ביטול תור שיזם הלקוח מהעמוד הציבורי.
 *
 * עקרונות (זהים ל-ownerBooking):
 *  - היעד הוא *מייל העסק עצמו*: business.ownerEmail, ובנפילה business.owner?.email.
 *    לעולם לא מייל הפלטפורמה — אם שניהם ריקים מדלגים בחן על המייל.
 *  - המייל נשלח דרך תשתית המייל הקיימת (sendEmail), שנופלת בחן ל-console כשאין SMTP,
 *    ולכן לעולם אינה חוסמת את הביטול.
 *  - קידום Web Push עתידי הוא מיטבי (getPushProvider().sendPush) ואינו חוסם.
 *  - הפונקציה לעולם אינה זורקת: כל ערוץ עטוף ב-try/catch ומחזיר תוצאה מובנית.
 *    הביטול וההתמדה קורים *לפני* הקריאה הזו, כך שדבר לא אובד גם אם ההתראה נכשלת.
 */

/** שירות בודד בגוף ההתראה (פרימיטיבים בלבד — עצמאי מטיפוסי Prisma לבדיקות קלות). */
export type OwnerCancellationService = {
  name: string;
};

export type OwnerCancellationPayload = {
  /** מזהה התור שבוטל. */
  appointmentId: string;
  /** שם העסק (לכותרת ולגוף). */
  businessName: string;
  /** מייל העסק (business.ownerEmail) — היעד המועדף. */
  ownerEmail?: string | null;
  /** מייל בעל העסק המשתמש (business.owner?.email) — נפילה. */
  ownerUserEmail?: string | null;
  /** שם הלקוח שביטל את התור. */
  clientName: string;
  /** טלפון הלקוח (אופציונלי). */
  clientPhone?: string | null;
  /** השירות/ים שהיו בתור שבוטל. */
  services: OwnerCancellationService[];
  /** תחילת התור שבוטל (רגע UTC). */
  startAt: Date;
  /** אזור הזמן של העסק (לעיצוב תאריך/שעה). */
  timezone: string;
  /** קישור מוחלט ליומן הניהול (נבנה אצל הקורא). */
  manageUrl: string;
};

export type NotifyOwnerCancellationResult = {
  /** האם ניסיון שליחת המייל הושלם ללא שגיאה (כולל נפילת console בפיתוח). */
  emailed: boolean;
  /** האם דילגנו על המייל מפני שאין ליעד כתובת מייל של העסק. */
  skipped: boolean;
  /** האם ספק המייל האמיתי (SMTP) מוגדר. */
  emailConfigured: boolean;
  /** תקצירי שגיאה (אם היו) לתיעוד. */
  errors: string[];
};

/**
 * יעד המייל של בעל העסק: מייל העסק עצמו, ובנפילה מייל המשתמש הבעלים.
 * לעולם לא מייל הפלטפורמה — כשאין אף אחד מהם מוחזר null (דילוג בחן).
 */
export function resolveOwnerCancellationTarget(input: {
  ownerEmail?: string | null;
  ownerUserEmail?: string | null;
}): string | null {
  return input.ownerEmail?.trim() || input.ownerUserEmail?.trim() || null;
}

/** בונה נושא, גוף טקסט וגוף HTML (RTL) להתראת ביטול התור. */
export function buildCancellationEmail(payload: OwnerCancellationPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const dateStr = formatDateString(payload.startAt, payload.timezone);
  const longDate = formatLongDate(dateStr, payload.timezone);
  const time = formatTime(payload.startAt, payload.timezone);
  const when = `${longDate} · ${time}`;
  const serviceNames = payload.services.map((s) => s.name).join(', ');

  const subject = `${BRAND.name} · תור בוטל · ${payload.businessName}`;

  const lines = [
    'לקוח/ה ביטל/ה תור בעסק שלך. המשבצת התפנתה.',
    '',
    `עסק: ${payload.businessName}`,
    `לקוח/ה: ${payload.clientName}`,
    ...(payload.clientPhone ? [`טלפון: ${payload.clientPhone}`] : []),
    ...(serviceNames ? [`שירות/ים: ${serviceNames}`] : []),
    `מועד שבוטל: ${when}`,
    '',
    `ליומן הניהול: ${payload.manageUrl}`,
  ];
  const text = lines.join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;white-space:nowrap">${label}</td><td style="padding:4px 0">${value}</td></tr>`;
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl;color:#0B1526">` +
    `<h2 style="color:#0A182D">תור בוטל</h2>` +
    `<p>לקוח/ה ביטל/ה תור דרך ${BRAND.name}. המשבצת התפנתה ביומן.</p>` +
    `<table style="border-collapse:collapse;font-size:15px">` +
    row('עסק', payload.businessName) +
    row('לקוח/ה', payload.clientName) +
    (payload.clientPhone
      ? row('טלפון', `<a href="tel:${payload.clientPhone}" style="color:#82643C">${payload.clientPhone}</a>`)
      : '') +
    (serviceNames ? row('שירות/ים', serviceNames) : '') +
    row('מועד שבוטל', when) +
    `</table>` +
    `<p style="margin-top:16px"><a href="${payload.manageUrl}" style="color:#82643C">מעבר ליומן הניהול</a></p>` +
    `</body></html>`;

  return { subject, text, html };
}

/**
 * שליחת התראת בעל העסק על ביטול תור בידי הלקוח. לעולם אינו זורק.
 * המייל נשלח למייל העסק בלבד; ההתראה באפליקציה (מבוססת-DB) עצמאית מכאן.
 */
export async function notifyOwnerOfCancellation(
  payload: OwnerCancellationPayload,
): Promise<NotifyOwnerCancellationResult> {
  const errors: string[] = [];
  let emailed = false;
  let skipped = false;

  const target = resolveOwnerCancellationTarget({
    ownerEmail: payload.ownerEmail,
    ownerUserEmail: payload.ownerUserEmail,
  });

  // ── ערוץ 1: מייל לעסק עצמו (רק אם יש כתובת מייל של העסק) ──────────────────
  if (!target) {
    skipped = true;
  } else {
    try {
      const { subject, text, html } = buildCancellationEmail(payload);
      await sendEmail(target, subject, text, html);
      emailed = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`email: ${msg}`);
      console.error(`[cancel:notify] email failed — ${msg}`);
    }
  }

  // ── ערוץ 2: קידום Web Push עתידי (מיטבי, stub כרגע) ───────────────────────
  try {
    await getPushProvider().sendPush(
      target ?? payload.businessName,
      `${BRAND.name} · תור בוטל`,
      `${payload.clientName} ביטל/ה תור בעסק ${payload.businessName}.`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`push: ${msg}`);
    console.error(`[cancel:notify] push failed — ${msg}`);
  }

  return { emailed, skipped, emailConfigured, errors };
}
