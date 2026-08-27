import { NextResponse } from 'next/server';
import { getPlatformAdminEmail } from '@/server/platformAdmin';
import { getBusinessById } from '@/server/repos/business';
import { setImpersonationCookie } from '@/server/impersonation';
import { getCanonicalOrigin } from '@/lib/canonicalHost';

export const dynamic = 'force-dynamic';

/**
 * GET /superadmin/impersonate/[businessId] — התחלת התחזות מנהל-על.
 *
 * שער נאכף כאן במפורש (route handler אינו עובר דרך admin/layout): מאמתים שהסשן
 * הוא מנהל-על אמיתי, ורק אז מוודאים שהעסק קיים וכותבים עוגייה חתומה (tc_imp, 8ש׳).
 * מי שאינו מנהל-על מופנה לעמוד הבית (בלי לחשוף שהנתיב קיים). לבסוף מפנים ל-/admin,
 * שם שער ה-layout ו-getActiveBusiness מזהים את העוגייה ומעמידים את אזור הניהול על העסק.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const origin = getCanonicalOrigin(process.env) ?? new URL(req.url).origin;

  const adminEmail = await getPlatformAdminEmail();
  if (!adminEmail) {
    // לא מנהל-על -> הפניה לעמוד הבית (לא חושפים את קיום הנתיב).
    return NextResponse.redirect(new URL('/', origin));
  }

  const { businessId } = await params;
  const business = await getBusinessById(businessId);
  if (!business) {
    return NextResponse.redirect(new URL('/superadmin', origin));
  }

  await setImpersonationCookie(businessId);

  // רישום ביקורת קליל (החלטה B): שורת לוג יחידה בצד השרת בתחילת ההתחזות.
  console.info(
    `[impersonation] start admin=${adminEmail} businessId=${businessId} at=${new Date().toISOString()}`,
  );

  return NextResponse.redirect(new URL('/admin', origin));
}
