// מקור אמת יחיד למצב הקמת העסק בעמוד הבעלים (באגים 8/9/10).
// נגזר מחמשת אזורי ההקמה (שירותים, צוות, שעות, מיתוג, פרטי עסק ומדיניות),
// ומזין גם את רצועת ההקמה/טבעת ההשלמה בבית וגם את ניווט ההמשך אל אשף האונבורדינג.
// טהור וניתן לבדיקה — נועל את היעד (נתיב האונבורדינג) ואת אחוז ההשלמה האמיתי.

/** נתיב אשף האונבורדינג — נפילת-ברירת-מחדל כשאין צעד פתוח (הכול הושלם). */
export const SETUP_CONTINUE_HREF = '/admin/onboarding';

/** חמשת דגלי אזורי ההקמה, בסדר הצגתם. */
export type SetupFlags = {
  servicesDone: boolean;
  staffDone: boolean;
  workingHoursDone: boolean;
  brandingDone: boolean;
  detailsDone: boolean;
};

/**
 * יעדי עומק-קישור לכל אזור הקמה — מקור אמת יחיד לכפתור «המשך» (רצועת ההקמה)
 * ולמגירת הכלים. תיקון באג 1: «המשך» מנווט ישירות למסך שבו חסרים הפרטים בפועל
 * (למשל מיתוג ← /admin/settings), ולא לתחילת האונבורדינג.
 */
export const SETUP_STEP_HREFS: Record<keyof SetupFlags, string> = {
  servicesDone: '/admin/services',
  staffDone: '/admin/team',
  workingHoursDone: '/admin/working-hours',
  brandingDone: '/admin/settings',
  detailsDone: '/admin/settings',
};

export type SetupState = {
  /** דגלי ההשלמה בסדר קבוע. */
  flags: boolean[];
  /** מספר האזורים הכולל (5). */
  total: number;
  /** כמה הושלמו. */
  done: number;
  /** אחוז השלמה מעוגל (0..100). */
  percent: number;
  /** הכול הושלם. */
  allComplete: boolean;
  /** כמה נותרו. */
  remaining: number;
  /** אינדקס הצעד הפתוח הראשון, או 1- אם הכול הושלם. */
  firstOpenIndex: number;
  /** יעד ניווט ההמשך — עומק-קישור למסך הצעד החסר הראשון (באג 1). */
  continueHref: string;
};

const SETUP_ORDER: (keyof SetupFlags)[] = [
  'servicesDone',
  'staffDone',
  'workingHoursDone',
  'brandingDone',
  'detailsDone',
];

/**
 * מחשב את מצב ההקמה מתוך חמשת הדגלים. טהור — ללא תופעות לוואי.
 * כשיש צעד חסר, `continueHref` הוא עומק-קישור למסך הצעד החסר הראשון (באג 1);
 * כשהכול הושלם הוא נופל לנתיב האונבורדינג. `percent` קטן מ-100 עד השלמה מלאה.
 */
export function computeSetupState(flags: SetupFlags): SetupState {
  const arr = SETUP_ORDER.map((k) => flags[k]);
  const total = arr.length;
  const done = arr.filter(Boolean).length;
  const percent = Math.round((done / total) * 100);
  const allComplete = done === total;
  const remaining = total - done;
  const firstOpenIndex = arr.findIndex((f) => !f);
  const continueHref =
    firstOpenIndex >= 0
      ? SETUP_STEP_HREFS[SETUP_ORDER[firstOpenIndex]]
      : SETUP_CONTINUE_HREF;
  return {
    flags: arr,
    total,
    done,
    percent,
    allComplete,
    remaining,
    firstOpenIndex,
    continueHref,
  };
}
