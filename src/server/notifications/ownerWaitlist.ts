import { BRAND } from '@/config/brand';
import { emailConfigured, sendEmail } from '@/server/providers/email';
import { getPushProvider } from '@/server/providers/push';
import { formatLongDate } from '@/lib/time';

/**
 * התראת בעל העסק על הצטרפות חדשה לרשימת ההמתנה דרך עמוד ההזמנה הציבורי.
 *
 * עקרונות (זהים ל-notifyOwnerOfBooking):
 *  - היעד הוא *מייל העסק עצמו*: business.ownerEmail, ובנפילה business.owner?.email.
 *    לעולם לא מייל הפלטפורמה — אם שניהם ריקים מדלגים בחן על המייל.
 *  - המייל נשלח דרך תשתית המייל הקיימת (sendEmail), שנופלת בחן ל-console כשאין SMTP,
 *    ולכן לעולם אינה חוסמת את ההצטרפות.
 *  - קידום Web Push עתידי הוא מיטבי (getPushProvider().sendPush) ואינו חוסם.
 *  - הפונקציה לעולם אינה זורקת: כל ערוץ עטוף ב-try/catch ומחזיר תוצאה מובנית.
 *    רשומת ההמתנה נוצרת *לפני* הקריאה הזו, כך שדבר לא אובד גם אם ההתראה נכשלת.
 */

export type OwnerWaitlistPayload = {
  /** מזהה רשומת ההמתנה שנוצרה. */
  entryId: string;
  /** שם העסק (לכותרת ולגוף). */
  businessName: string;
  /** מייל העסק (business.ownerEmail) — היעד המועדף. */
  ownerEmail?: string | null;
  /** מייל בעל העסק המשתמש (business.owner?.email) — נפילה. */
  ownerUserEmail?: string | null;
  /** שם הלקוח שנרשם לרשימת ההמתנה. */
  clientName: string;
  /** טלפון הלקוח (אופציונלי). */
  clientPhone?: string | null;
  /** שם השירות המבוקש (אופציונלי). */
  serviceName?: string | null;
  /** היום המבוקש בפורמט YYYY-MM-DD (אופציונלי). */
  desiredDate?: string | null;
  /** חלון זמן מועדף — התחלה בדקות מחצות (אופציונלי). */
  earliestMinute?: number | null;
  /** חלון זמן מועדף — סוף בדקות מחצות (אופציונלי). */
  latestMinute?: number | null;
  /** אזור הזמן של העסק (לעיצוב תאריך). */
  timezone: string;
  /** קישור מוחלט לעמוד ניהול רשימת ההמתנה (נבנה אצל הקורא). */
  waitlistUrl: string;
};

export type NotifyOwnerWaitlistResult = {
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
export function resolveOwnerWaitlistTarget(input: {
  ownerEmail?: string | null;
  ownerUserEmail?: string | null;
}): string | null {
  return input.ownerEmail?.trim() || input.ownerUserEmail?.trim() || null;
}

/** דקות מחצות ל-"HH:MM" (מרופד באפסים). מחזיר null לערך לא תקין. */
function minutesToLabel(minute?: number | null): string | null {
  if (minute == null || !Number.isFinite(minute)) return null;
  const clamped = Math.max(0, Math.min(1439, Math.round(minute)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** תיאור חלון הזמן המועדף כטקסט קריא, או null כשאין. */
function describeWindow(earliestMinute?: number | null, latestMinute?: number | null): string | null {
  const from = minutesToLabel(earliestMinute);
  const to = minutesToLabel(latestMinute);
  if (from && to) return `${from}–${to}`;
  if (from) return `מ-${from}`;
  if (to) return `עד ${to}`;
  return null;
}

/** בונה נושא, גוף טקסט וגוף HTML (RTL) להתראת ההצטרפות לרשימת ההמתנה. */
export function buildWaitlistEmail(payload: OwnerWaitlistPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const when = payload.desiredDate ? formatLongDate(payload.desiredDate, payload.timezone) : null;
  const windowLabel = describeWindow(payload.earliestMinute, payload.latestMinute);

  const subject = `${BRAND.name} · הצטרפות חדשה לרשימת ההמתנה · ${payload.businessName}`;

  const lines = [
    'מישהו הצטרף לרשימת ההמתנה דרך עמוד ההזמנה.',
    '',
    `עסק: ${payload.businessName}`,
    `לקוח/ה: ${payload.clientName}`,
    ...(payload.clientPhone ? [`טלפון: ${payload.clientPhone}`] : []),
    ...(payload.serviceName ? [`שירות: ${payload.serviceName}`] : []),
    ...(when ? [`יום מבוקש: ${when}`] : []),
    ...(windowLabel ? [`חלון זמן מועדף: ${windowLabel}`] : []),
    '',
    `לניהול רשימת ההמתנה: ${payload.waitlistUrl}`,
  ];
  const text = lines.join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;white-space:nowrap">${label}</td><td style="padding:4px 0">${value}</td></tr>`;
  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl;color:#0B1526">` +
    `<h2 style="color:#0A182D">הצטרפות חדשה לרשימת ההמתנה</h2>` +
    `<p>מישהו הצטרף לרשימת ההמתנה דרך ${BRAND.name}, כשלא נותרו מועדים פנויים ליום המבוקש.</p>` +
    `<table style="border-collapse:collapse;font-size:15px">` +
    row('עסק', payload.businessName) +
    row('לקוח/ה', payload.clientName) +
    (payload.clientPhone
      ? row('טלפון', `<a href="tel:${payload.clientPhone}" style="color:#82643C">${payload.clientPhone}</a>`)
      : '') +
    (payload.serviceName ? row('שירות', payload.serviceName) : '') +
    (when ? row('יום מבוקש', when) : '') +
    (windowLabel ? row('חלון זמן מועדף', windowLabel) : '') +
    `</table>` +
    `<p style="margin-top:16px"><a href="${payload.waitlistUrl}" style="color:#82643C">מעבר לניהול רשימת ההמתנה</a></p>` +
    `</body></html>`;

  return { subject, text, html };
}

/**
 * שליחת התראת בעל העסק על הצטרפות לרשימת ההמתנה. לעולם אינו זורק.
 * המייל נשלח למייל העסק בלבד; רשומת ההמתנה כבר נשמרה לפני הקריאה.
 */
export async function notifyOwnerOfWaitlist(
  payload: OwnerWaitlistPayload,
): Promise<NotifyOwnerWaitlistResult> {
  const errors: string[] = [];
  let emailed = false;
  let skipped = false;

  const target = resolveOwnerWaitlistTarget({
    ownerEmail: payload.ownerEmail,
    ownerUserEmail: payload.ownerUserEmail,
  });

  // ── ערוץ 1: מייל לעסק עצמו (רק אם יש כתובת מייל של העסק) ──────────────────
  if (!target) {
    skipped = true;
  } else {
    try {
      const { subject, text, html } = buildWaitlistEmail(payload);
      await sendEmail(target, subject, text, html);
      emailed = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`email: ${msg}`);
      console.error(`[waitlist:notify] email failed — ${msg}`);
    }
  }

  // ── ערוץ 2: קידום Web Push עתידי (מיטבי, stub כרגע) ───────────────────────
  try {
    await getPushProvider().sendPush(
      target ?? payload.businessName,
      `${BRAND.name} · הצטרפות לרשימת המתנה`,
      `${payload.clientName} הצטרף/ה לרשימת ההמתנה בעסק ${payload.businessName}.`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`push: ${msg}`);
    console.error(`[waitlist:notify] push failed — ${msg}`);
  }

  return { emailed, skipped, emailConfigured, errors };
}
