import { BRAND } from '@/config/brand';
import { emailConfigured, sendEmail } from '@/server/providers/email';
import { getPushProvider } from '@/server/providers/push';
import { formatAgorot } from '@/lib/money';
import { formatDateString, formatLongDate, formatTime } from '@/lib/time';

/**
 * התראת בעל העסק על הזמנה חדשה שממתינה לאישור (סטטוס PENDING).
 *
 * עקרונות:
 *  - היעד הוא *מייל העסק עצמו*: business.ownerEmail, ובנפילה business.owner?.email.
 *    לעולם לא מייל הפלטפורמה — אם שניהם ריקים מדלגים בחן על המייל.
 *  - המייל נשלח דרך תשתית המייל הקיימת (sendEmail), שנופלת בחן ל-console כשאין SMTP,
 *    ולכן לעולם אינה חוסמת את ההזמנה.
 *  - קידום Web Push עתידי הוא מיטבי (getPushProvider().sendPush) ואינו חוסם.
 *  - הפונקציה לעולם אינה זורקת: כל ערוץ עטוף ב-try/catch ומחזיר תוצאה מובנית.
 *    יצירת התור וההתמדה קורות *לפני* הקריאה הזו, כך שדבר לא אובד גם אם ההתראה נכשלת.
 */

/** שירות בודד בגוף ההתראה (פרימיטיבים בלבד — עצמאי מטיפוסי Prisma לבדיקות קלות). */
export type OwnerBookingService = {
  name: string;
  priceAgorot: number;
};

export type OwnerBookingPayload = {
  /** מזהה התור שנוצר. */
  appointmentId: string;
  /** שם העסק (לכותרת ולגוף). */
  businessName: string;
  /** מייל העסק (business.ownerEmail) — היעד המועדף. */
  ownerEmail?: string | null;
  /** מייל בעל העסק המשתמש (business.owner?.email) — נפילה. */
  ownerUserEmail?: string | null;
  /** שם הלקוח שקבע את התור. */
  clientName: string;
  /** טלפון הלקוח (אופציונלי). */
  clientPhone?: string | null;
  /** השירות/ים שנבחרו. */
  services: OwnerBookingService[];
  /** תחילת התור (רגע UTC). */
  startAt: Date;
  /** אזור הזמן של העסק (לעיצוב תאריך/שעה). */
  timezone: string;
  /** מחיר כולל באגורות. */
  totalPriceAgorot: number;
  /**
   * האם ההזמנה ממתינה לאישור העסק. ברירת מחדל true לשמירת תאימות לאחור עם קוראים
   * קיימים ובדיקות (עד כה ההתראה נשלחה רק לתורים ממתינים). כש-false, ההזמנה אושרה
   * אוטומטית והנוסח משתנה בהתאם ("הזמנה חדשה" במקום "ממתינה לאישור").
   */
  requiresApproval?: boolean;
  /** קישור מוחלט לעמוד ניהול התורים (נבנה אצל הקורא). */
  approvalsUrl: string;
  /** מזהה העסק — נדרש לשליחת Web Push למנויי הדפדפן של בעל העסק (אופציונלי). */
  businessId?: string;
  /** האם ערוץ ה-Web Push דלוק בהגדרות העסק (ברירת מחדל false — כבוי). */
  pushEnabled?: boolean;
};

export type NotifyOwnerBookingResult = {
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
export function resolveOwnerBookingTarget(input: {
  ownerEmail?: string | null;
  ownerUserEmail?: string | null;
}): string | null {
  return input.ownerEmail?.trim() || input.ownerUserEmail?.trim() || null;
}

/** בונה נושא, גוף טקסט וגוף HTML (RTL) להתראת ההזמנה הממתינה. */
export function buildBookingEmail(payload: OwnerBookingPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const dateStr = formatDateString(payload.startAt, payload.timezone);
  const longDate = formatLongDate(dateStr, payload.timezone);
  const time = formatTime(payload.startAt, payload.timezone);
  const when = `${longDate} · ${time}`;
  const serviceNames = payload.services.map((s) => s.name).join(', ');
  const price = formatAgorot(payload.totalPriceAgorot);

  // ברירת מחדל true לתאימות לאחור: קורא שלא מציין requiresApproval מקבל את הנוסח
  // הקיים ("ממתינה לאישור"). תור שאושר אוטומטית (false) מקבל נוסח "הזמנה חדשה".
  const pendingApproval = payload.requiresApproval ?? true;
  const headline = pendingApproval ? 'הזמנה חדשה ממתינה לאישור' : 'הזמנה חדשה התקבלה';
  const introText = pendingApproval
    ? 'התקבלה הזמנה חדשה הממתינה לאישורך.'
    : 'התקבלה הזמנה חדשה בעסק שלך.';
  const ctaText = pendingApproval ? 'לאישור התור' : 'למעבר לתור';
  const ctaHtml = pendingApproval ? 'מעבר לאישור התור' : 'מעבר לתור';

  const subject = pendingApproval
    ? `${BRAND.name} · הזמנה חדשה ממתינה לאישור · ${payload.businessName}`
    : `${BRAND.name} · הזמנה חדשה · ${payload.businessName}`;

  const lines = [
    introText,
    '',
    `עסק: ${payload.businessName}`,
    `לקוח/ה: ${payload.clientName}`,
    ...(payload.clientPhone ? [`טלפון: ${payload.clientPhone}`] : []),
    `שירות/ים: ${serviceNames}`,
    `מועד: ${when}`,
    `מחיר: ${price}`,
    '',
    `${ctaText}: ${payload.approvalsUrl}`,
  ];
  const text = lines.join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;white-space:nowrap">${label}</td><td style="padding:4px 0">${value}</td></tr>`;
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl;color:#0B1526">` +
    `<h2 style="color:#0A182D">${headline}</h2>` +
    `<p>${introText.replace('.', '')} דרך ${BRAND.name}.</p>` +
    `<table style="border-collapse:collapse;font-size:15px">` +
    row('עסק', payload.businessName) +
    row('לקוח/ה', payload.clientName) +
    (payload.clientPhone
      ? row('טלפון', `<a href="tel:${payload.clientPhone}" style="color:#82643C">${payload.clientPhone}</a>`)
      : '') +
    row('שירות/ים', serviceNames) +
    row('מועד', when) +
    row('מחיר', price) +
    `</table>` +
    `<p style="margin-top:16px"><a href="${payload.approvalsUrl}" style="color:#82643C">${ctaHtml}</a></p>` +
    `</body></html>`;

  return { subject, text, html };
}

/**
 * שליחת התראת בעל העסק על הזמנה ממתינה. לעולם אינו זורק.
 * המייל נשלח למייל העסק בלבד; ההתראה באפליקציה (מבוססת-DB) עצמאית מכאן.
 */
export async function notifyOwnerOfBooking(
  payload: OwnerBookingPayload,
): Promise<NotifyOwnerBookingResult> {
  const errors: string[] = [];
  let emailed = false;
  let skipped = false;

  const target = resolveOwnerBookingTarget({
    ownerEmail: payload.ownerEmail,
    ownerUserEmail: payload.ownerUserEmail,
  });

  // ── ערוץ 1: מייל לעסק עצמו (רק אם יש כתובת מייל של העסק) ──────────────────
  if (!target) {
    skipped = true;
  } else {
    try {
      const { subject, text, html } = buildBookingEmail(payload);
      await sendEmail(target, subject, text, html);
      emailed = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`email: ${msg}`);
      console.error(`[booking:notify] email failed — ${msg}`);
    }
  }

  // ── ערוץ 2: Web Push לבעל העסק (מיטבי, לעולם לא חוסם) ────────────────────
  // כשיש businessId והמתג pushEnabled אינו כבוי במפורש — שולחים למנויי הדפדפן של
  // העסק דרך sendToBusiness (מימוש VAPID אמיתי, מתדרדר בחן ל-console כשאין מפתחות).
  // קוראים ותיקים ללא businessId שומרים על ההתנהגות הקודמת (sendPush stub) לתאימות.
  const pushTitle = pendingApprovalPush(payload)
    ? `${BRAND.name} · הזמנה ממתינה לאישור`
    : `${BRAND.name} · הזמנה חדשה`;
  const pushBody = `${payload.clientName} קבע/ה תור בעסק ${payload.businessName}.`;
  try {
    const push = getPushProvider();
    if (payload.businessId && payload.pushEnabled !== false) {
      await push.sendToBusiness(payload.businessId, pushTitle, pushBody, payload.approvalsUrl);
    } else {
      await push.sendPush(target ?? payload.businessName, pushTitle, pushBody);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`push: ${msg}`);
    console.error(`[booking:notify] push failed — ${msg}`);
  }

  return { emailed, skipped, emailConfigured, errors };
}

/** האם נוסח הפוש הוא "ממתינה לאישור" (ברירת מחדל true לתאימות לאחור). */
function pendingApprovalPush(payload: OwnerBookingPayload): boolean {
  return payload.requiresApproval ?? true;
}
