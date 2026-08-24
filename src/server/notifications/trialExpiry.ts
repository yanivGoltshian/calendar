import { BRAND } from '@/config/brand';
import { getCanonicalOrigin } from '@/lib/canonicalHost';
import { sendEmail } from '@/server/providers/email';
import { t } from '@/i18n';

/**
 * התראות מייל אוטומטיות לבעל העסק סביב סוף תקופת הניסיון החינמית (cron יומי).
 *
 * חמש שכבות (קצב 7/3/1/0 ואחרי):
 *  - 'warn7' / 'warn' / 'warn1' — 7 / 3 / 1 ימים לפני סוף הניסיון (תזכורות לבחור חבילה).
 *  - 'expired'                  — ביום הפקיעה (אזור הניהול וההזמנות הציבוריות ננעלים).
 *  - 'postExpired'              — כשלושה ימים לאחר הפקיעה (הזמנה לחדש ולהפעיל מחדש).
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

export type TrialNoticeTier = 'warn7' | 'warn' | 'warn1' | 'expired' | 'postExpired';

const DAY_MS = 24 * 60 * 60 * 1000;
/** מספר הימים לפני סוף הניסיון בשכבת האזהרה הראשית (נשמר לתאימות לאחור). */
export const TRIAL_WARN_DAYS = 3;
/** חצי רוחב חלון הסבילות סביב כל יעד שכבה (±12ש׳ → פגיעה אחת לכל ריצה יומית). */
const TOLERANCE_MS = 12 * 60 * 60 * 1000;

/**
 * מפת השכבות: לכל שכבה היסט ימים של trialEndsAt מרגע הריצה (חיובי=עתיד, שלילי=עבר)
 * וכמות הימים ({days}) לשיבוץ בקופי. סדר יורד לפי היסט כדי שהמסווג יבחר את השכבה
 * המוקדמת ביותר בגבול. הקצב: 7/3/1 ימים לפני, ביום הפקיעה, ו-3 ימים אחרי (חידוש).
 */
const TRIAL_NOTICE_TIERS: ReadonlyArray<{
  tier: TrialNoticeTier;
  offsetDays: number;
  days: number;
}> = [
  { tier: 'warn7', offsetDays: 7, days: 7 },
  { tier: 'warn', offsetDays: 3, days: 3 },
  { tier: 'warn1', offsetDays: 1, days: 1 },
  { tier: 'expired', offsetDays: 0, days: 0 },
  { tier: 'postExpired', offsetDays: -3, days: 3 },
];

/** ממפה שכבה לכמות הימים ({days}) לשיבוץ בקופי המייל. */
function tierDays(tier: TrialNoticeTier): number {
  return TRIAL_NOTICE_TIERS.find((x) => x.tier === tier)?.days ?? TRIAL_WARN_DAYS;
}

/**
 * מסווג טהור: לאיזו שכבת התראה (אם בכלל) שייך עסק לפי מועד סוף הניסיון ורגע הריצה.
 * מחזיר null כשאין מה לשלוח (אין תאריך, או שהעסק אינו בחלון של אף שכבה). נבדק לפי סדר
 * TRIAL_NOTICE_TIERS (היסט יורד) והחלונות אינם חופפים, כך שכל עסק שייך לכל היותר לשכבה אחת.
 */
export function classifyTrialNotice(
  trialEndsAt: Date | null | undefined,
  now: Date,
): TrialNoticeTier | null {
  if (!trialEndsAt) return null;
  const diff = trialEndsAt.getTime() - now.getTime();
  if (Number.isNaN(diff)) return null;
  for (const { tier, offsetDays } of TRIAL_NOTICE_TIERS) {
    if (Math.abs(diff - offsetDays * DAY_MS) <= TOLERANCE_MS) return tier;
  }
  return null;
}

export type TrialEmailContent = { subject: string; text: string; html: string };

/**
 * בונה את תוכן מייל ההתראה (נושא + טקסט + HTML) לשכבה נתונה. טהור וניתן לבדיקה.
 * {days} נגזר מהשכבה (tierDays) — 7/3/1 לפני, 0 בפקיעה, 3 לאחריה — כך שהקופי יציב.
 */
export function buildTrialExpiryEmail(
  tier: TrialNoticeTier,
  input: { ownerName: string; businessName: string; ctaUrl: string },
): TrialEmailContent {
  type TrialCopy = { subject: string; heading: string; body: string; cta: string };
  const copyByTier: Record<TrialNoticeTier, TrialCopy> = {
    warn7: t.billing.trialEmail.warn7,
    warn: t.billing.trialEmail.warn,
    warn1: t.billing.trialEmail.warn1,
    expired: t.billing.trialEmail.expired,
    postExpired: t.billing.trialEmail.postExpired,
  };
  const copy = copyByTier[tier];
  const fill = (s: string) =>
    s
      .replace(/\{days\}/g, String(tierDays(tier)))
      .replace(/\{name\}/g, input.ownerName)
      .replace(/\{business\}/g, input.businessName);

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

export type WhatsAppStubResult = {
  channel: 'whatsapp';
  tier: TrialNoticeTier;
  sent: false;
  reason: 'pending-meta-approval';
};

/**
 * ערוץ WhatsApp להתראות הניסיון — stub מכוון מאחורי אותו טריגר של המייל.
 * אינטגרציית WhatsApp/ACS חסומה על אישור Meta (בהמתנה), ולכן זו פעולת no-op שמחזירה
 * תוצאה מובנית בלבד ואינה שולחת דבר. כשה-ACS יעלה יש להחליף את גוף הפונקציה בשליחה
 * בפועל (למשל sendWhatsApp(phone, buildTrialExpiryWhatsApp(tier, ...))) — הטריגר,
 * השכבות והקצב כבר קיימים, כך שהערוץ "נדלק" ללא שינוי בלוגיקת ההפעלה.
 */
export function notifyOwnerViaWhatsAppStub(tier: TrialNoticeTier): WhatsAppStubResult {
  return { channel: 'whatsapp', tier, sent: false, reason: 'pending-meta-approval' };
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
  /**
   * האם הופעל ה-stub של ערוץ WhatsApp מאחורי אותו טריגר (Meta בהמתנה ⇒ לא נשלח בפועל).
   * דגל דיאגנוסטי בלבד; יתחלף בשליחה אמיתית כשה-ACS יעלה.
   */
  whatsappStubbed?: boolean;
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

  // ערוץ WhatsApp מאחורי אותו טריגר: כרגע stub (Meta בהמתנה) — no-op שמסמן שהערוץ קיים
  // ויידלק כשה-ACS יעלה. אינו מעכב את מסלול המייל ואינו זורק.
  notifyOwnerViaWhatsAppStub(tier);

  const to = target.ownerEmail?.trim();
  if (!to) {
    return {
      businessId: target.businessId,
      tier,
      emailed: false,
      skipped: true,
      whatsappStubbed: true,
    };
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
    return {
      businessId: target.businessId,
      tier,
      emailed: true,
      skipped: false,
      whatsappStubbed: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      businessId: target.businessId,
      tier,
      emailed: false,
      skipped: false,
      error: msg,
      whatsappStubbed: true,
    };
  }
}
