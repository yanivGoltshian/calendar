import type { BusinessPlan, SubscriptionStatus } from '@prisma/client';
import { t } from '@/i18n';

/**
 * גישה למנוי — מחושבת על קריאה (ללא תלות ב-cron שמעדכן סטטוס).
 *
 * active = (חבילת בסיס בתקופת ניסיון ו-trialEndsAt בעתיד)
 *          או (חבילת פרימיום/אקסלוסיב ו-paidUntil בעתיד).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** תת-קבוצת השדות הדרושים לחישוב הגישה (כל רשומת Business עונה על כך). */
export type BusinessAccessInput = {
  plan: BusinessPlan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
};

export type AccessState = 'trialing' | 'active' | 'expired';

export type BusinessAccess = {
  /** האם יש גישה פעילה לאזור הניהול. */
  active: boolean;
  /** המצב המחושב (לתצוגה ולוגיקה). */
  state: AccessState;
  /** ימים שנותרו עד סוף הניסיון/התשלום (0 כשפג תוקף). */
  daysLeft: number;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
};

/** מחשב ימים שלמים שנותרו עד תאריך יעד (עיגול כלפי מעלה, לא שלילי). */
function daysUntil(target: Date | null, nowMs: number): number {
  if (!target) return 0;
  const diff = target.getTime() - nowMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / DAY_MS);
}

/**
 * חבילות בתשלום (ללא ניסיון) — גישתן נגזרת מ-paidUntil, לא מ-trialEndsAt.
 * כרגע: פרימיום ואקסלוסיב. הבסיס לבדו הוא דרגת הניסיון.
 */
function isPaidPlan(plan: BusinessPlan): boolean {
  return plan === 'premium' || plan === 'exclusive';
}

/**
 * חישוב מצב הגישה של עסק לפי החבילה והתאריכים. מחושב תמיד מחדש על קריאה.
 * - פרימיום/אקסקלוסיב עם paidUntil בעתיד ⇐ active (שניהם מסלולים בתשלום).
 * - בסיס עם trialEndsAt בעתיד ⇐ trialing.
 * - אחרת ⇐ expired (חסום).
 */
export function getBusinessAccess(business: BusinessAccessInput): BusinessAccess {
  const nowMs = Date.now();
  const { plan, trialEndsAt, paidUntil } = business;

  // מסלולים בתשלום — פרימיום ואקסקלוסיב. הבסיס (סטנדרט) הוא מסלול הניסיון/החינם.
  const paidActive =
    isPaidPlan(plan) && paidUntil != null && paidUntil.getTime() > nowMs;
  const trialActive =
    !isPaidPlan(plan) && trialEndsAt != null && trialEndsAt.getTime() > nowMs;

  if (paidActive) {
    return {
      active: true,
      state: 'active',
      daysLeft: daysUntil(paidUntil, nowMs),
      trialEndsAt,
      paidUntil,
    };
  }

  if (trialActive) {
    return {
      active: true,
      state: 'trialing',
      daysLeft: daysUntil(trialEndsAt, nowMs),
      trialEndsAt,
      paidUntil,
    };
  }

  return {
    active: false,
    state: 'expired',
    daysLeft: 0,
    trialEndsAt,
    paidUntil,
  };
}

/**
 * האם העסק רשאי לקבל הזמנות דרך העמוד הציבורי.
 *
 * חסימת ההזמנות הציבוריות בפקיעת הניסיון או המנוי מונעת שימוש חינמי בלתי מוגבל
 * בפלטפורמה דרך העמוד הציבורי. זהו מקור אמת יחיד המשותף לעמוד ההזמנה (UI) ולנתיבי
 * ה-API (‎/api/book, ‎/api/availability), כך שהאכיפה בצד השרת עקבית עם התצוגה.
 */
export function canAcceptPublicBookings(business: BusinessAccessInput): boolean {
  return getBusinessAccess(business).active;
}

/** תווית עברית קריאה למצב הגישה (למשל לתצוגה בטבלת הסופר-אדמין ובבאנר). */
export function describeAccessState(state: AccessState): string {
  return t.billing.status[state];
}

/** תווית עברית קריאה לשם החבילה (סטנדרט / פרימיום / אקסקלוסיב). */
export function describePlan(plan: BusinessPlan): string {
  if (plan === 'exclusive') return t.billing.plan.exclusive;
  if (plan === 'premium') return t.billing.plan.premium;
  return t.billing.plan.basic;
}

/**
 * שער יכולת: האם מותר לעסק לשלוח מסרון בתשלום ללקוח קצה
 * (אישור, תזכורת, קמפיין, רשימת המתנה). דלוק רק בחבילת אקסלוסיב
 * עם מנוי פעיל בתשלום — לא בניסיון, ולא בפרימיום/בסיס (הם פונים במייל).
 */
export function canSendPaidClientSms(business: BusinessAccessInput): boolean {
  return business.plan === 'exclusive' && getBusinessAccess(business).state === 'active';
}

/**
 * שער יכולת: האם מותר לאמת טלפון של לקוח קצה במסרון. תכונת אקסלוסיב בלבד,
 * בכפיפה לאותם תנאים כמו המסרון בתשלום ללקוח. בפרימיום/בסיס אין אימות טלפון ללקוח.
 */
export function canVerifyClientPhone(business: BusinessAccessInput): boolean {
  return canSendPaidClientSms(business);
}

/**
 * שער יכולת: אימות טלפון של בעל העסק עצמו (הרשמה/התחברות). חריג קבוע —
 * דלוק תמיד בכל דרגה, כי זו כניסת מערכת ואינה פנייה ללקוח קצה, ואינו כפוף
 * לתקרת העלות הפר-עסקית של פניות ללקוח.
 */
export function canSendOwnerVerificationSms(): boolean {
  return true;
}
