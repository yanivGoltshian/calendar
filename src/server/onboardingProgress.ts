/**
 * התקדמות האונבורדינג ⇐ רמת עיטור העמוד הציבורי.
 *
 * הרעיון (החלטת מוצר): עושר העמוד הציבורי נקבע לפי כמה מהאונבורדינג הבעלים
 * השלים בלי לדלג, ולא לפי החבילה (סטנדרט / פרימיום / אקסקלוסיב). ככל שהושלמו
 * יותר צעדים — העמוד עשיר יותר, עד המראה ה"פרימיום" המלא, וזה זמין לכל החבילות
 * כולל סטנדרט. דילוג על צעדים ⇐ עמוד פשוט יותר. השלמת הכול ⇐ העמוד העשיר ביותר.
 *
 * מקור האמת המועדף הוא BusinessSettings.onboardingSteps (JSON). כשאין נתון מפורש
 * (עסקים ותיקים מלפני המעקב), נופלים חזרה לאותות מהמידע עצמו: קיום שירותים,
 * שעות פעילות, מיתוג (לוגו + צבע) ותוכן נחיתה עשיר.
 */

/** ארבעת צעדי האונבורדינג שמזינים את רמת העיטור. */
export type OnboardingStepKey = 'services' | 'hours' | 'branding' | 'richContent';

export const ONBOARDING_STEP_KEYS: readonly OnboardingStepKey[] = [
  'services',
  'hours',
  'branding',
  'richContent',
] as const;

/** צורת ה-JSON השמור ב-BusinessSettings.onboardingSteps. */
export type OnboardingStepsJson = Partial<Record<OnboardingStepKey, boolean>> & {
  /** צעדים שהבעלים דילג עליהם במפורש (משפיעים לרעה על רמת העיטור). */
  skipped?: string[];
};

/** רמת העיטור הבדידה של העמוד הציבורי: 0 (פשוט) עד 3 (עשיר/פרימיום מלא). */
export type VisualLevel = 0 | 1 | 2 | 3;

export type OnboardingProgress = {
  /** אילו מבין ארבעת הצעדים הושלמו (מ-JSON או מאותות המידע). */
  steps: Record<OnboardingStepKey, boolean>;
  /** כמה צעדים הושלמו (0..4). */
  completedCount: number;
  /** סך הצעדים האפשריים (4). */
  totalSteps: number;
  /** אחוז ההשלמה (0..100, מעוגל). */
  percent: number;
  /** צעדים שדולגו במפורש. */
  skipped: OnboardingStepKey[];
  /** האם קיים תוכן נחיתה עשיר (השלב שפותח את פריסת הנחיתה). */
  hasRichContent: boolean;
  /** רמת העיטור הנגזרת לעמוד הציבורי. */
  visualLevel: VisualLevel;
};

/** האותות הגולמיים לחישוב ההתקדמות (מנותקים מ-Prisma לשם שימוש חוזר ובדיקות). */
export type OnboardingSignals = {
  /** ה-JSON מ-BusinessSettings.onboardingSteps (מקור אמת מועדף). */
  onboardingSteps?: unknown;
  /** קיים לפחות שירות אחד גלוי. */
  hasServices: boolean;
  /** הוגדרה לפחות שורת שעות פעילות אחת. */
  hasWorkingHours: boolean;
  /** מיתוג מלא — לוגו וגם צבע מותג. */
  hasBranding: boolean;
  /** תוכן נחיתה עשיר קיים (עמוד הנחיתה נבנה באונבורדינג). */
  hasRichContent: boolean;
};

/** פירוק בטוח של ה-JSON השמור; ערכים לא צפויים מתעלמים בשקט. */
export function parseOnboardingSteps(raw: unknown): OnboardingStepsJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: OnboardingStepsJson = {};
  for (const key of ONBOARDING_STEP_KEYS) {
    if (obj[key] === true) out[key] = true;
  }
  if (Array.isArray(obj.skipped)) {
    out.skipped = obj.skipped.filter((s): s is string => typeof s === 'string');
  }
  return out;
}

/**
 * חישוב ההתקדמות ורמת העיטור מהאותות. הכלל:
 * - צעד נחשב שהושלם אם ה-JSON מסמן אותו true, או אם אות המידע קיים.
 * - שלושת צעדי הליבה (שירותים, שעות, מיתוג) קובעים כמה "מלוטש" העמוד.
 * - צעד תוכן הנחיתה (richContent) הוא זה שפותח את פריסת הנחיתה עצמה, ולכן
 *   רמות 2–3 (פריסת נחיתה) דורשות אותו — כך לעולם לא מרנדרים נחיתה בלי תוכן.
 *   ליבה מלאה + תוכן עשיר ⇐ רמה 3 (הפרימיום המלא). תוכן עשיר בלי ליבה מלאה
 *   (דילוג) ⇐ רמה 2 (נחיתה פשוטה יותר). בלי תוכן עשיר ⇐ רמה 1/0 לפי הליבה.
 */
export function computeOnboardingProgress(signals: OnboardingSignals): OnboardingProgress {
  const json = parseOnboardingSteps(signals.onboardingSteps);
  const steps: Record<OnboardingStepKey, boolean> = {
    services: json.services === true || signals.hasServices,
    hours: json.hours === true || signals.hasWorkingHours,
    branding: json.branding === true || signals.hasBranding,
    richContent: json.richContent === true || signals.hasRichContent,
  };

  const skipped = (json.skipped ?? []).filter((s): s is OnboardingStepKey =>
    (ONBOARDING_STEP_KEYS as readonly string[]).includes(s),
  );

  const completedCount = ONBOARDING_STEP_KEYS.reduce(
    (n, key) => (steps[key] ? n + 1 : n),
    0,
  );
  const coreCount =
    (steps.services ? 1 : 0) + (steps.hours ? 1 : 0) + (steps.branding ? 1 : 0);
  const hasRichContent = steps.richContent;

  let visualLevel: VisualLevel;
  if (!hasRichContent) {
    visualLevel = coreCount >= 3 ? 1 : 0;
  } else {
    visualLevel = coreCount >= 3 ? 3 : 2;
  }

  const percent = Math.round((completedCount / ONBOARDING_STEP_KEYS.length) * 100);

  return {
    steps,
    completedCount,
    totalSteps: ONBOARDING_STEP_KEYS.length,
    percent,
    skipped,
    hasRichContent,
    visualLevel,
  };
}

/**
 * נוחות לעמוד הציבורי: גוזר את האותות מרשומת העסק ומחזיר את ההתקדמות/הרמה.
 * hasRichContent נקבע לפי קיום תוכן נחיתה מנורמל (לא לפי סגנון העמוד בלבד), כדי
 * שתצוגה מקדימה זמנית ‎?style=landing‎ לא תנפח את הרמה לעסק ללא תוכן.
 */
export function visualLevelForPublicPage(input: {
  onboardingSteps: unknown;
  servicesCount: number;
  workingHoursCount: number;
  logoUrl?: string | null;
  brandColor?: string | null;
  hasLandingContent: boolean;
}): OnboardingProgress {
  return computeOnboardingProgress({
    onboardingSteps: input.onboardingSteps,
    hasServices: input.servicesCount > 0,
    hasWorkingHours: input.workingHoursCount > 0,
    hasBranding: Boolean(input.logoUrl && input.brandColor),
    hasRichContent: input.hasLandingContent,
  });
}
