import { isValidEmail, normalizeEmail } from '@/lib/crypto';

/**
 * לוגיקת ה-authorize של ספק 'owner-email' (כניסת מייל לבעלים מגובת OTP).
 *
 * חולץ מ-`src/auth.ts` לפונקציה טהורה עם הזרקת תלויות (checkOtp, findOrCreateUserByEmail)
 * כדי שיהיה ניתן לבדיקה ישירה בלי NextAuth ובלי Prisma. אין שינוי התנהגות: מנרמל את
 * המייל, דורש מייל תקין וקוד באורך 4 ומעלה, מאמת OTP, ומחזיר משתמש מזוהה-מייל או null.
 */

export type OwnerEmailUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type OwnerEmailAuthorizeDeps = {
  checkOtp: (identity: string, code: string) => Promise<{ ok: boolean }>;
  findOrCreateUserByEmail: (email: string, name?: string) => Promise<OwnerEmailUser>;
};

export type OwnerEmailCredentials = {
  email?: unknown;
  code?: unknown;
};

export type OwnerEmailAuthorized = {
  id: string;
  email: string;
  name: string | undefined;
};

export async function authorizeOwnerEmail(
  raw: OwnerEmailCredentials | undefined,
  deps: OwnerEmailAuthorizeDeps,
): Promise<OwnerEmailAuthorized | null> {
  const email = normalizeEmail(String(raw?.email ?? ''));
  const code = String(raw?.code ?? '').trim();
  if (!isValidEmail(email) || code.length < 4) return null;

  const result = await deps.checkOtp(email, code);
  if (!result.ok) return null;

  const user = await deps.findOrCreateUserByEmail(email);
  return {
    id: user.id,
    email: user.email ?? email,
    name: user.name ?? undefined,
  };
}
