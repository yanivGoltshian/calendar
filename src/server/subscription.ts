import type { BusinessPlan, SubscriptionStatus } from '@prisma/client';
import { t } from '@/i18n';

/**
 * גישה למנוי — מחושבת על קריאה (ללא תלות ב-cron שמעדכן סטטוס).
 *
 * active = (חבילת בסיס בתקופת ניסיון ו-trialEndsAt בעתיד)
 *          או (חבילת פרימיום ו-paidUntil בעתיד).
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
 * חישוב מצב הגישה של עסק לפי החבילה והתאריכים. מחושב תמיד מחדש על קריאה.
 * - פרימיום עם paidUntil בעתיד ⇐ active.
 * - בסיס עם trialEndsAt בעתיד ⇐ trialing.
 * - אחרת ⇐ expired (חסום).
 */
export function getBusinessAccess(business: BusinessAccessInput): BusinessAccess {
  const nowMs = Date.now();
  const { plan, trialEndsAt, paidUntil } = business;

  const premiumActive =
    plan === 'premium' && paidUntil != null && paidUntil.getTime() > nowMs;
  const trialActive =
    plan !== 'premium' && trialEndsAt != null && trialEndsAt.getTime() > nowMs;

  if (premiumActive) {
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

/** תווית עברית קריאה למצב הגישה (למשל לתצוגה בטבלת הסופר-אדמין ובבאנר). */
export function describeAccessState(state: AccessState): string {
  return t.billing.status[state];
}

/** תווית עברית קריאה לשם החבילה. */
export function describePlan(plan: BusinessPlan): string {
  return plan === 'premium' ? t.billing.plan.premium : t.billing.plan.basic;
}
