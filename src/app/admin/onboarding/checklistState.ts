import { cookies } from 'next/headers';

/**
 * מצב רשימת ההמשך של ההקמה (אונבורדינג) בלוח הניהול.
 * ההסתרה נשמרת בעוגייה ייעודית ולא ב-onboardingCompleted, כדי לא לפגוע
 * בקריאת ה-CTA של אשף ההקמה בהגדרות. מודול רגיל (ללא 'use server') כדי
 * לאפשר ייצוא קבוע וקורא שמשמשים גם רכיב שרת וגם פעולת השרת שמסתירה.
 */

/** שם העוגייה שמסתירה את רשימת ההמשך של ההקמה בלוח הניהול. */
export const ONBOARDING_CHECKLIST_DISMISS_COOKIE = 'torchick_onboarding_dismissed';

/** האם הבעלים בחר להסתיר את רשימת ההמשך של ההקמה. */
export async function isOnboardingChecklistDismissed(): Promise<boolean> {
  const store = await cookies();
  return store.get(ONBOARDING_CHECKLIST_DISMISS_COOKIE)?.value === '1';
}
