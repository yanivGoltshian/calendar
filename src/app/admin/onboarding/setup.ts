// מקור אמת יחיד למצב הקמת העסק בעמוד הבעלים (באגים 8/9/10).
// נגזר מחמשת אזורי ההקמה (שירותים, צוות, שעות, מיתוג, פרטי עסק ומדיניות),
// ומזין גם את רצועת ההקמה/טבעת ההשלמה בבית וגם את ניווט ההמשך אל אשף האונבורדינג.
// טהור וניתן לבדיקה — נועל את היעד (נתיב האונבורדינג) ואת אחוז ההשלמה האמיתי.

/** נתיב אשף האונבורדינג — יעד ניווט ההמשך (טבעת ההשלמה + כפתור «המשך»). */
export const SETUP_CONTINUE_HREF = '/admin/onboarding';

/** חמשת דגלי אזורי ההקמה, בסדר הצגתם. */
export type SetupFlags = {
  servicesDone: boolean;
  staffDone: boolean;
  workingHoursDone: boolean;
  brandingDone: boolean;
  detailsDone: boolean;
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
  /** יעד ניווט ההמשך (אשף האונבורדינג, נפתח בצעד החסר הראשון). */
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
 * כשאין השלמה, `continueHref` תמיד נתיב האונבורדינג, ו-`percent` קטן מ-100.
 */
export function computeSetupState(flags: SetupFlags): SetupState {
  const arr = SETUP_ORDER.map((k) => flags[k]);
  const total = arr.length;
  const done = arr.filter(Boolean).length;
  const percent = Math.round((done / total) * 100);
  const allComplete = done === total;
  const remaining = total - done;
  const firstOpenIndex = arr.findIndex((f) => !f);
  return {
    flags: arr,
    total,
    done,
    percent,
    allComplete,
    remaining,
    firstOpenIndex,
    continueHref: SETUP_CONTINUE_HREF,
  };
}
