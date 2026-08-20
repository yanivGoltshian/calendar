/**
 * הרשאות ל"אזור הניהול של העסק לפי כתובת העסק" — /b/[slug]/admin.
 *
 * הרעיון: בעל עסק מגיע לאזור הניהול שלו פשוט על ידי הוספת /admin לכתובת העסק
 * הציבורית שלו (/b/[slug]). הגישה מותרת רק לבעלים הרשום של אותו slug (ownerEmail)
 * ובנוסף למנהלי הפלטפורמה (ניהול-על). ההשוואה למייל הבעלים חסרת רגישות לאותיות
 * גדולות/קטנות ולרווחים, בדיוק כמו שער ניהול-העל.
 *
 * הלוגיקה מרוכזת כאן כפונקציות טהורות (בסגנון ownerRouting.ts) כדי שאפשר יהיה
 * לבדוק אותה ישירות ביחידה, והדף (page.tsx) רק צורך אותן ומבצע את ההפניה בפועל.
 */

/** יעד ההפניה של בעל העסק — אזור הניהול הקנוני (owned[0] עבור בעל עסק יחיד). */
export const OWNER_ADMIN_HREF = '/admin';
/** יעד ההפניה של מנהל פלטפורמה שאינו הבעלים של ה-slug — קונסולת ניהול-העל. */
export const PLATFORM_CONSOLE_HREF = '/superadmin';

/** האם המייל המאומת תואם למייל הבעלים הרשום (השוואה חסרת רגישות לאותיות/רווחים). */
export function isBusinessOwnerEmail(
  email: string | null | undefined,
  ownerEmail: string | null | undefined,
): boolean {
  if (!email || !ownerEmail) return false;
  return email.trim().toLowerCase() === ownerEmail.trim().toLowerCase();
}

export type BusinessAdminAccessInput = {
  /** המייל המאומת של המבקר (או null/undefined כשאינו מחובר). */
  email: string | null | undefined;
  /** מייל הבעלים הרשום על העסק (Business.ownerEmail, עשוי להיות null). */
  ownerEmail: string | null | undefined;
  /** האם המבקר הוא מנהל פלטפורמה (isPlatformAdminEmail חושב מראש בצד השרת). */
  isPlatformAdmin: boolean;
};

/**
 * האם למבקר יש גישה כלשהי לאזור הניהול של העסק:
 * מנהל פלטפורמה תמיד רשאי; אחרת רק הבעלים הרשום של אותו slug.
 * לא מחליף את בדיקת השרת — נגזר מנתונים שכבר אומתו בצד השרת.
 */
export function canAccessBusinessAdmin(input: BusinessAdminAccessInput): boolean {
  if (input.isPlatformAdmin) return true;
  return isBusinessOwnerEmail(input.email, input.ownerEmail);
}

/**
 * החלטת הניתוב של /b/[slug]/admin (טהורה):
 * - 'login'     : לא מחובר -> מסך כניסת בעלים עם חזרה לאותה כתובת.
 * - 'owner'     : הבעלים הרשום של ה-slug -> אזור הניהול הקנוני (/admin).
 * - 'platform'  : מנהל פלטפורמה שאינו הבעלים -> קונסולת ניהול-העל (/superadmin).
 * - 'forbidden' : מחובר אך אינו בעלים ואינו מנהל פלטפורמה -> 404 (בלי דליפת דיירים).
 *
 * סדר העדיפות: בעלות קודמת למנהל פלטפורמה, כך שבעל עסק שהוא גם מנהל פלטפורמה
 * המגיע לכתובת העסק שלו עצמו מנותב לאזור הניהול של העסק ולא לקונסולת הפלטפורמה.
 */
export type BusinessAdminRoute = 'login' | 'owner' | 'platform' | 'forbidden';

export function decideBusinessAdminRoute(input: BusinessAdminAccessInput): BusinessAdminRoute {
  if (!input.email) return 'login';
  if (isBusinessOwnerEmail(input.email, input.ownerEmail)) return 'owner';
  if (input.isPlatformAdmin) return 'platform';
  return 'forbidden';
}
