import { prisma } from '@/lib/db';
import { fingerprintHash, isValidIsraeliMobile, normalizeEmail, normalizePhone } from '@/lib/crypto';

/**
 * דג׳ר טביעות-אצבע לניסיון חינם (anti-abuse). מטרתו למנוע ניצול של "מחיקת חשבון
 * והרשמה מחדש" כדי לקבל תקופת ניסיון חדשה שוב ושוב. הדג׳ר עמיד ל-purge (מודל עצמאי
 * שאינו נמחק עם העסק/המשתמש) ושומר רק hash חד-כיווני של המייל/טלפון המנורמלים.
 */

const TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrialSubscriptionStatus = 'trialing' | 'expired';

export interface TrialDecision {
  /** האם המזהה כבר נראה בעבר (הרשמה חוזרת). */
  isReturning: boolean;
  /** מועד סיום הניסיון שייקבע לעסק החדש. */
  trialEndsAt: Date;
  /** מצב המנוי הראשוני הנגזר מהתאריך שלמעלה. */
  subscriptionStatus: TrialSubscriptionStatus;
}

/**
 * חישוב טביעות-האצבע (hash) של המייל והטלפון. טהור ודטרמיניסטי: מייל מנורמל לאותיות
 * קטנות, טלפון מנורמל ל-E.164. מחושב phoneHash רק לנייד ישראלי תקין — טלפון ריק, לא
 * תקין או זבל מחזיר phoneHash=null. הדבר קריטי: normalizePhone סלחני וממפה קלט זבל
 * ל-"+972", כך שבלי בדיקת תקינות שני נרשמים שונים היו מקבלים אותו phoneHash, מתנגשים
 * במפתח הייחודי ומזהים זה את זה בטעות כהרשמה חוזרת.
 */
export function computeTrialHashes(
  ownerEmail: string,
  phone: string | null,
  googleSub?: string | null,
): { emailHash: string; phoneHash: string | null; googleSubHash: string | null } {
  const emailHash = fingerprintHash(normalizeEmail(ownerEmail));
  let phoneHash: string | null = null;
  if (phone && isValidIsraeliMobile(phone)) {
    phoneHash = fingerprintHash(normalizePhone(phone));
  }
  const googleSubHash = googleSub ? fingerprintHash(googleSub.trim()) : null;
  return { emailHash, phoneHash, googleSubHash };
}

/**
 * לב ההחלטה, טהור ובר-בדיקה: בהינתן מועד סיום הניסיון המקורי (אם המזהה נראה בעבר)
 * ומועד "עכשיו" — מכריע מה לקבוע לעסק החדש.
 *  • הרשמה חוזרת → מחזיר את מועד הסיום המקורי (ללא הארכה). אם עבר, המצב expired
 *    והעסק ייחסם מיד על-ידי אכיפת המנוי (Step B).
 *  • הרשמה ראשונה → ניסיון חדש של 30 יום, מצב trialing.
 */
export function resolveTrialDecision(
  existingOriginalTrialEndsAt: Date | null,
  now: Date,
  trialDays: number = TRIAL_DAYS,
): TrialDecision {
  if (existingOriginalTrialEndsAt) {
    const trialEndsAt = existingOriginalTrialEndsAt;
    return {
      isReturning: true,
      trialEndsAt,
      subscriptionStatus: trialEndsAt.getTime() > now.getTime() ? 'trialing' : 'expired',
    };
  }
  const trialEndsAt = new Date(now.getTime() + trialDays * DAY_MS);
  return { isReturning: false, trialEndsAt, subscriptionStatus: 'trialing' };
}

/** בניית תנאי OR לחיפוש לפי אחד מה-hashים, בלי להכניס תנאי null שיתפוס רשומות ריקות. */
function buildHashOr(emailHash: string, phoneHash: string | null, googleSubHash: string | null) {
  const or: Array<{ emailHash: string } | { phoneHash: string } | { googleSubHash: string }> = [
    { emailHash },
  ];
  if (phoneHash) or.push({ phoneHash });
  if (googleSubHash) or.push({ googleSubHash });
  return or;
}

/**
 * החלטת ניסיון להרשמה חדשה, מול הדג׳ר בבסיס הנתונים. מזהה הרשמה חוזרת לפי מייל או
 * טלפון, ואם לא נראה בעבר — רושם רשומה חדשה. עמיד למרוץ (unique) עם fallback לקריאה
 * חוזרת. אף פעם לא שובר יצירת עסק: כשל בכתיבת הדג׳ר נבלע ומחזיר ניסיון חדש (fail-open),
 * כי חסימת בעלים לגיטימי חמורה מהחמצת חסימת מנצל נדיר.
 */
export async function decideTrialForRegistration(
  ownerEmail: string,
  phone: string | null,
  now: Date = new Date(),
  googleSub: string | null = null,
): Promise<TrialDecision> {
  const { emailHash, phoneHash, googleSubHash } = computeTrialHashes(ownerEmail, phone, googleSub);
  const or = buildHashOr(emailHash, phoneHash, googleSubHash);

  let existing: { id: string; originalTrialEndsAt: Date } | null = null;
  try {
    existing = await prisma.trialLedger.findFirst({
      where: { OR: or },
      select: { id: true, originalTrialEndsAt: true },
    });
  } catch {
    // הדג׳ר אינו זמין (למשל טרם הורצה המיגרציה): נכשל-פתוח לניסיון חדש.
    return resolveTrialDecision(null, now);
  }

  const decision = resolveTrialDecision(existing?.originalTrialEndsAt ?? null, now);

  if (existing) {
    // הרשמה חוזרת: עדכון מונה בלבד; לא מאריכים ולא יוצרים רשומה חדשה.
    try {
      await prisma.trialLedger.update({
        where: { id: existing.id },
        data: { registrationCount: { increment: 1 } },
      });
    } catch {
      // עדכון המונה נכשל; ההחלטה כבר נגזרה מהערך הקיים ואינה מושפעת.
    }
    return decision;
  }

  // הרשמה ראשונה: רישום רשומת דג׳ר חדשה עם מועד הסיום שנקבע.
  try {
    await prisma.trialLedger.create({
      data: {
        emailHash,
        phoneHash,
        googleSubHash,
        originalTrialEndsAt: decision.trialEndsAt,
        firstTrialStartedAt: now,
      },
    });
  } catch {
    // מרוץ: רשומה נוצרה במקביל תחת אותו hash. קריאה חוזרת ושימוש בערך הקיים.
    try {
      const again = await prisma.trialLedger.findFirst({
        where: { OR: or },
        select: { originalTrialEndsAt: true },
      });
      if (again) return resolveTrialDecision(again.originalTrialEndsAt, now);
    } catch {
      // נכשל-פתוח: מחזירים את ההחלטה המקורית (ניסיון חדש).
    }
  }
  return decision;
}
