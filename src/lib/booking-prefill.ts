/**
 * עוזרים טהורים לחישוב מצב הפתיחה של זרימת ההזמנה מתוך קדם-בחירה (deep link).
 * מופרדים מרכיב ה-BookingStepper (client) כדי שיהיו ניתנים לבדיקת יחידה בלי React,
 * ומשמשים גם את הקישור העמוק של "קביעת תור חוזר" (rebook) שמסמן שירות ואיש צוות.
 */

export type BookingStep = 0 | 1 | 2 | 3 | 4 | 5;

export type BookingPrefillInput = {
  /** האם הגיע שירות תקין מסומן מראש (?service או ?rebook). */
  hasPreselectedService: boolean;
  /** האם הגיע איש צוות תקין מסומן מראש (?staff), קיים ברשימת הצוות. */
  hasPreselectedStaff: boolean;
  /** האם לעסק יש נותן שירות יחיד (ואז שלב הצוות מדולג ממילא). */
  singleStaff: boolean;
};

/**
 * חישוב שלב הפתיחה של זרימת ההזמנה לפי הקדם-בחירה:
 * - בלי שירות מסומן מראש → מתחילים מבחירת השירות (שלב 0).
 * - שירות מסומן מראש + איש צוות ידוע (נבחר מראש או יחיד) → קופצים ישר לבחירת מועד (שלב 2).
 * - שירות מסומן מראש בלי איש צוות ידוע (יש כמה) → שלב בחירת הצוות (שלב 1).
 */
export function initialBookingStep(input: BookingPrefillInput): BookingStep {
  if (!input.hasPreselectedService) return 0;
  if (input.hasPreselectedStaff || input.singleStaff) return 2;
  return 1;
}

/**
 * מזהה איש הצוות ההתחלתי: הנבחר מראש (אם תקין) גובר; אחרת נותן שירות יחיד; אחרת ריק.
 * שומר על ההתנהגות הקיימת (יחיד → נבחר מראש) ומוסיף כיבוד של ?staff תקין.
 */
export function initialStaffId(input: {
  preselectedStaffId: string | null;
  isPreselectedStaffValid: boolean;
  singleStaff: boolean;
  firstStaffId: string | null;
}): string {
  if (input.isPreselectedStaffValid && input.preselectedStaffId) {
    return input.preselectedStaffId;
  }
  if (input.singleStaff && input.firstStaffId) return input.firstStaffId;
  return '';
}
