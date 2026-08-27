import { cookies } from 'next/headers';
import { getPlatformAdminEmail } from '@/server/platformAdmin';
import {
  signImpersonationValue,
  verifyImpersonationValue,
  resolveImpersonatedBusinessId,
  IMPERSONATION_TTL_SECONDS,
} from './impersonationToken';

/**
 * התחזות מנהל-על — שכבת העוגייה והשער (עטיפה סביב הלוגיקה הטהורה שב-impersonationToken).
 *
 * מנהל-על (Yaniv) יכול "להיכנס כבעל העסק": נכתבת עוגייה חתומה עם businessId, וכל עץ
 * ‎/admin/* מזהה אותה דרך getActiveBusiness() ודרך שער ה-layout. העוגייה חתומה, מוגבלת
 * בזמן, ולעולם אינה נאמנת לבדה — getImpersonatedBusinessId מוודא שוב, בכל קריאה בצד השרת,
 * שהסשן הנוכחי הוא אכן מנהל-על.
 */

const COOKIE_NAME = 'tc_imp';

/** כותב עוגיית התחזות חתומה עבור businessId (Route Handler / Server Action בלבד). */
export async function setImpersonationCookie(businessId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, signImpersonationValue(businessId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: IMPERSONATION_TTL_SECONDS,
  });
}

/** מוחק את עוגיית ההתחזות (יציאה מהתחזות). */
export async function clearImpersonationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * מזהה העסק שאליו מתחזים כרגע — או null.
 *
 * שער האמון היחיד: (1) מאמת חתימה+תוקף של העוגייה; (2) ורק אז מוודא שהסשן הנוכחי הוא
 * מנהל-על. אם אחד מהם נכשל — מוחזר null, כך שאסימון מזויף/גנוב בסשן שאינו מנהל-על
 * אינו מקנה כל גישה.
 */
export async function getImpersonatedBusinessId(): Promise<string | null> {
  const store = await cookies();
  const token = verifyImpersonationValue(store.get(COOKIE_NAME)?.value);
  if (!token) return null;
  const adminEmail = await getPlatformAdminEmail();
  return resolveImpersonatedBusinessId({ token, isPlatformAdmin: Boolean(adminEmail) });
}

export {
  signImpersonationValue,
  verifyImpersonationValue,
  resolveImpersonatedBusinessId,
  IMPERSONATION_TTL_SECONDS,
} from './impersonationToken';
export type { ImpersonationToken } from './impersonationToken';

export { COOKIE_NAME as IMPERSONATION_COOKIE_NAME };
