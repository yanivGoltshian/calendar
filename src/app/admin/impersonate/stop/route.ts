import { NextResponse } from 'next/server';
import { getPlatformAdminEmail } from '@/server/platformAdmin';
import { clearImpersonationCookie } from '@/server/impersonation';
import { getCanonicalOrigin } from '@/lib/canonicalHost';

export const dynamic = 'force-dynamic';

/**
 * GET /admin/impersonate/stop — יציאה מהתחזות מנהל-על.
 *
 * מוחק את עוגיית ההתחזות (tc_imp) ומחזיר את מנהל-העל לקונסולת ניהול-העל.
 * מחיקת העוגייה בטוחה תמיד: גם אם הסשן אינו מנהל-על, אין נזק בניקויה. משם ואילך
 * getActiveBusiness ושער ה-layout חוזרים לזרימה הרגילה (מנהל-על -> /superadmin).
 */
export async function GET(req: Request) {
  const origin = getCanonicalOrigin(process.env) ?? new URL(req.url).origin;

  const adminEmail = await getPlatformAdminEmail();
  await clearImpersonationCookie();

  // רישום ביקורת קליל (החלטה B): שורת לוג יחידה בצד השרת בסיום ההתחזות.
  console.info(
    `[impersonation] stop admin=${adminEmail ?? 'unknown'} at=${new Date().toISOString()}`,
  );

  return NextResponse.redirect(new URL('/superadmin', origin));
}
