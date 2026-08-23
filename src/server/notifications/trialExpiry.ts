import { BRAND } from '@/config/brand';
import { getCanonicalOrigin } from '@/lib/canonicalHost';
import { sendEmail } from '@/server/providers/email';
import { t } from '@/i18n';

/**
 * התראות מייל אוטומטיות לבעל העסק סביב סוף תקופת הניסיון החינמית (cron יומי).
 *
 * שתי שכבות:
 *  - 'warn'    — כשלושה ימים לפני סוף הניסיון (תזכורת עדינה לבחור חבילה).
 *  - 'expired' — ביום שבו הניסיון פג (אזור הניהול ננעל; העמוד הציבורי ממשיך).
 *
 * אידמפוטנטיות ללא עמודת DB: ה-cron רץ פעם ביום, והמסווג משתמש בחלון סבילות של
 * ±12 שעות סביב כל יעד. מכיוון שריצות עוקבות מרוחקות ~24 שעות, כל עסק חוצה כל
 * שכבה בדיוק פעם אחת. זו אותה פילוסופיה של חלון הזמן בתזכורות ה-24 שעות, ללא
 * צורך במיגרציה. ריצה ידנית (workflow_dispatch) באותו יום עלולה לשלוח שוב, וזו
 * סבילות מקובלת עבור הודעת נימוס בתדירות נמוכה.
 *
 * העיקרון: הפונקציות כאן טהורות/עצמאיות מ-Prisma ככל האפשר, והשליחה לעולם אינה
 * זורקת — כל ערוץ עטוף ומחזיר תוצאה מובנית.
 */

export type TrialNoticeTier = 'warn' | 'expired';

const DAY_MS = 24 * 60 * 60 * 1000;
/** מספר הימים לפני סוף הניסיון שבו נשלחת שכבת האזהרה. */
export const TRIAL_WARN_DAYS = 3;
/** חצי רוחב חלון הסבילות סביב כל יעד שכבה (±12ש׳ → פגיעה אחת לכל ריצה יומית). */
const TOLERANCE_MS = 12 * 60 * 60 * 1000;

/**
 * מסווג טהור: לאיזו שכבת התראה (אם בכלל) שייך עסק לפי מועד סוף הניסיון ורגע הריצה.
 * מחזיר null כשאין מה לשלוח (אין תאריך, או שהעסק אינו בחלון של אף שכבה).
 */
export function classifyTrialNotice(
  trialEndsAt: Date | null | undefined,
  now: Date,
): TrialNoticeTier | null {
  if (!trialEndsAt) return null;
  const diff = trialEndsAt.getTime() - now.getTime();
  if (Number.isNaN(diff)) return null;
  // שכבת אזהרה: כ-TRIAL_WARN_DAYS ימים לפני הסוף.
  if (Math.abs(diff - TRIAL_WARN_DAYS * DAY_MS) <= TOLERANCE_MS) return 'warn';
  // שכבת פקיעה: רגע סוף הניסיון עצמו.
  if (Math.abs(diff) <= TOLERANCE_MS) return 'expired';
  return null;
}

export type TrialEmailContent = { subject: string; text: string; html: string };

/**
 * בונה את תוכן מייל ההתראה (נושא + טקסט + HTML) לשכבה נתונה. טהור וניתן לבדיקה.
 * {days} בשכבת האזהרה תמיד שווה ל-TRIAL_WARN_DAYS (סמנטיקת השכבה), לכן הקופי יציב.
 */
export function buildTrialExpiryEmail(
  tier: TrialNoticeTier,
  input: { ownerName: string; businessName: string; ctaUrl: string },
): TrialEmailContent {
  const copy = tier === 'warn' ? t.billing.trialEmail.warn : t.billing.trialEmail.expired;
  const fill = (s: string) =>
    s
      .replace('{days}', String(TRIAL_WARN_DAYS))
      .replace('{name}', input.ownerName)
      .replace('{business}', input.businessName);

  const subject = fill(copy.subject);
  const heading = fill(copy.heading);
  const body = fill(copy.body);
  const cta = copy.cta;
  const footer = t.billing.trialEmail.footer;

  const text = [
    heading,
    '',
    body,
    '',
    input.ctaUrl ? `${cta}: ${input.ctaUrl}` : cta,
    '',
    footer,
  ].join('\n');

  const html =
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl;color:#0B1526">` +
    `<h2 style="color:${BRAND.themeColor}">${heading}</h2>` +
    `<p style="font-size:15px;line-height:1.6">${body}</p>` +
    (input.ctaUrl
      ? `<p style="margin-top:16px"><a href="${input.ctaUrl}" style="background:${BRAND.themeColor};color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">${cta}</a></p>`
      : `<p style="margin-top:16px">${cta}</p>`) +
    `<p style="color:#6B7280;font-size:13px;margin-top:24px">${footer}</p>` +
    `</body></html>`;

  return { subject, text, html };
}

/** יעד התראה בודד (פרימיטיבים בלבד — עצמאי מטיפוסי Prisma לבדיקות קלות). */
export type TrialExpiryTarget = {
  businessId: string;
  businessName: string;
  /** מייל היעד: business.ownerEmail או, בנפילה, מייל בעל העסק המשתמש. */
  ownerEmail?: string | null;
  /** שם בעל העסק לפנייה אישית (בנפילה — שם העסק). */
  ownerName?: string | null;
  trialEndsAt: Date | null;
};

export type TrialExpiryDispatchResult = {
  businessId: string;
  /** השכבה שסווגה, או null אם העסק אינו בחלון אף שכבה. */
  tier: TrialNoticeTier | null;
  /** האם ניסיון שליחת המייל הושלם ללא שגיאה (כולל נפילת console בפיתוח). */
  emailed: boolean;
  /** האם דילגנו (אין שכבה או אין כתובת מייל). */
  skipped: boolean;
  /** תקציר שגיאה (אם הייתה) לתיעוד. */
  error?: string;
};

export type TrialExpiryNotifyDeps = {
  sendEmail: typeof sendEmail;
  canonicalOrigin: () => string | null;
};

const defaultNotifyDeps: TrialExpiryNotifyDeps = {
  sendEmail,
  canonicalOrigin: () => getCanonicalOrigin(),
};

/**
 * שליחת מייל התראת ניסיון לבעל עסק בודד. לעולם אינו זורק.
 * מסווג את השכבה, בונה קופי עברי, ושולח דרך תשתית המייל הקיימת (שנופלת בחן
 * ל-console כשאין SMTP). ערוץ WhatsApp אינו נשלח כאן: הוא חבילת exclusive וחסום
 * על אישור Meta (ראו אינטגרציית WhatsApp הפתוחה) — no-op מכוון עד לפתיחתו.
 */
export async function notifyOwnerOfTrialExpiry(
  target: TrialExpiryTarget,
  now: Date,
  deps: TrialExpiryNotifyDeps = defaultNotifyDeps,
): Promise<TrialExpiryDispatchResult> {
  const tier = classifyTrialNotice(target.trialEndsAt, now);
  if (!tier) {
    return { businessId: target.businessId, tier: null, emailed: false, skipped: true };
  }

  const to = target.ownerEmail?.trim();
  if (!to) {
    return { businessId: target.businessId, tier, emailed: false, skipped: true };
  }

  const origin = deps.canonicalOrigin() ?? '';
  const ctaUrl = origin ? `${origin}/admin/upgrade` : '';
  const { subject, text, html } = buildTrialExpiryEmail(tier, {
    ownerName: target.ownerName?.trim() || target.businessName,
    businessName: target.businessName,
    ctaUrl,
  });

  try {
    await deps.sendEmail(to, subject, text, html);
    return { businessId: target.businessId, tier, emailed: true, skipped: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { businessId: target.businessId, tier, emailed: false, skipped: false, error: msg };
  }
}
