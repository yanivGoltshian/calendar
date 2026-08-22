import type { BusinessPlan } from '@prisma/client';
import { t } from '@/i18n';

/**
 * שכבת ההרשאות לפי מסלול (tier). מקור אמת יחיד להבדלים ההתנהגותיים בין שלוש
 * החבילות, כדי שכל שער בקוד (הזמנה, תזכורות, הודעות, הרשמה) ייגזר מכאן ולא ישכפל
 * תנאי plan מקומי.
 *
 * שלוש החבילות, נבדלות אך ורק בערוצי התקשורת ללקוח הקצה:
 *   basic     (סטנדרט)   — הזמנת אורח (שם + טלפון חובה), ללא מייל/וואטסאפ/הרשמה.
 *   premium   (פרימיום)  — כל מה שבסטנדרט, ובנוסף מיילים (אישור הזמנה + תזכורות)
 *                           והרשמת לקוחות.
 *   exclusive (אקסקלוסיב) — כל מה שבפרימיום, ובנוסף וואטסאפ (אישור + תזכורות בוואטסאפ).
 *                           ערוץ הוואטסאפ הוא נתיק (pluggable): ה-seam לשליחה מוגדר כאן,
 *                           והחיווט הקונקרטי (Azure ACS) נשלט בסשן ייעודי שיתבסס מעליי.
 *
 * ההיררכיה מונוטונית: exclusive ⊇ premium ⊇ basic. שער העיצוב של העמוד הציבורי
 * אינו כאן — הוא נגזר מהתקדמות האונבורדינג (ראו onboardingProgress.ts) ואינו תלוי
 * מסלול.
 */

/** המסלולים שיש להם ערוץ מייל ללקוח (אישור הזמנה + תזכורות + הרשמה). */
export function canEmailClients(plan: BusinessPlan): boolean {
  return plan === 'premium' || plan === 'exclusive';
}

/** המסלולים שיש להם ערוץ וואטסאפ ללקוח (אישור + תזכורות בוואטסאפ). אקסקלוסיב בלבד. */
export function canWhatsappClients(plan: BusinessPlan): boolean {
  return plan === 'exclusive';
}

/**
 * האם המסלול דורש מייל מהלקוח בעת ההזמנה. פרימיום/אקסקלוסיב שולחים מייל אישור,
 * ולכן המייל חובה לצדם; סטנדרט אינו אוסף מייל כלל (שם + טלפון בלבד).
 */
export function requiresClientEmail(plan: BusinessPlan): boolean {
  return plan === 'premium' || plan === 'exclusive';
}

/** האם המסלול מאפשר הרשמת לקוחות קצה (חשבונות). פרימיום/אקסקלוסיב בלבד. */
export function allowsClientRegistration(plan: BusinessPlan): boolean {
  return plan === 'premium' || plan === 'exclusive';
}

/**
 * האם ליצור תזכורות מתוזמנות להזמנה. סטנדרט אינו שולח תזכורות ללקוח, ולכן אין
 * טעם ליצור רשומת תזכורת; פרימיום/אקסקלוסיב מתזמנים תזכורת (מייל ובאקסקלוסיב גם וואטסאפ).
 */
export function schedulesReminders(plan: BusinessPlan): boolean {
  return plan === 'premium' || plan === 'exclusive';
}

/** תווית עברית קריאה לשם המסלול (סטנדרט / פרימיום / אקסקלוסיב). */
export function tierLabel(plan: BusinessPlan): string {
  if (plan === 'exclusive') return t.billing.plan.exclusive;
  if (plan === 'premium') return t.billing.plan.premium;
  return t.billing.plan.basic;
}

/** אוסף ההרשאות של מסלול במבנה יחיד — נוח לתצוגת לוח הבקרה ולהעברה לרכיבים. */
export type TierEntitlements = {
  plan: BusinessPlan;
  label: string;
  canEmailClients: boolean;
  canWhatsappClients: boolean;
  requiresClientEmail: boolean;
  allowsClientRegistration: boolean;
  schedulesReminders: boolean;
};

/** גוזר את כל הרשאות המסלול במקום אחד. */
export function entitlementsForPlan(plan: BusinessPlan): TierEntitlements {
  return {
    plan,
    label: tierLabel(plan),
    canEmailClients: canEmailClients(plan),
    canWhatsappClients: canWhatsappClients(plan),
    requiresClientEmail: requiresClientEmail(plan),
    allowsClientRegistration: allowsClientRegistration(plan),
    schedulesReminders: schedulesReminders(plan),
  };
}
