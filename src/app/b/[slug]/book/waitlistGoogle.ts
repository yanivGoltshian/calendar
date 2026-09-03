/**
 * לוגיקה טהורה (ללא React) עבור טופס רשימת ההמתנה: מתי להציג את כפתור ההתחברות
 * עם גוגל, ומהו ה-callbackUrl שאליו גוגל יחזיר את הלקוח.
 *
 * מופרד לקובץ נפרד כדי שניתן יהיה לבדוק אותו ישירות ב-node test runner בלי לטעון
 * את רכיב הכפתור (שמייבא next-auth/react ולכן אינו נטען בסביבת הבדיקה).
 */

/**
 * כפתור גוגל בטופס רשימת ההמתנה מוצג רק כאשר הלקוח אינו מחובר (authed=false)
 * וההתחברות עם גוגל מופעלת בעסק (googleEnabled=true). מחובר → הפרטים כבר מולאו
 * מהסשן ואין צורך בכפתור. גוגל כבוי → אין ערוץ התחברות להציע.
 */
export function shouldShowWaitlistGoogle(
  authed: boolean | undefined,
  googleEnabled: boolean | undefined,
): boolean {
  return !authed && !!googleEnabled;
}

/**
 * ה-callbackUrl לחזרה מגוגל אל עמוד ההזמנה של העסק — זהה לדפוס שבשלב 5 של המסלול:
 * מעבר דרך גשר הזהות /account/continue שממנו הלקוח מופנה חזרה ל-next.
 */
export function waitlistGoogleCallbackUrl(slug: string): string {
  return `/account/continue?next=${encodeURIComponent(`/b/${slug}/book`)}`;
}
