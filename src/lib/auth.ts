import { redirect } from 'next/navigation';
import { getClientSession, type ClientSession } from '@/lib/session';

/**
 * עזרי אימות לצד השרת (Server Components / Server Actions).
 *
 * אלה עוטפים את getClientSession מ-src/lib/session.ts ומספקים שער נוח לעמודים
 * מוגנים. ה-middleware כבר חוסם כניסה גסה, אך עמודי שרת עדיין צריכים את פרטי
 * ההתחברות המאומתים (חתימה מלאה) — לכן משתמשים כאן ב-getClientSession.
 */

/** מחזיר את ההתחברות הנוכחית או null (ללא הפניה). */
export async function getOptionalSession(): Promise<ClientSession | null> {
  return getClientSession();
}

/**
 * מחייב התחברות: אם אין session תקין — הפניה ל-/login עם פרמטר redirect.
 * מיועד לעמודי /account ולכל עמוד לקוח מוגן.
 */
export async function requireClientSession(
  redirectTo = '/account',
): Promise<ClientSession> {
  const session = await getClientSession();
  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  }
  return session;
}

/**
 * שער אזור הניהול. ב-MVP האימות הוא ברמת "מחובר" בלבד (אין תפקיד ב-session),
 * ואכיפת הרשאות ברמת עסק היא משימת המשך מתועדת. אם אין session — הפניה ל-/login.
 */
export async function requireAdminSession(): Promise<ClientSession> {
  const session = await getClientSession();
  if (!session) {
    redirect('/login?redirect=/admin');
  }
  return session;
}
