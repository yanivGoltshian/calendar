import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail, getBusinessById } from '@/server/repos/business';
import { getImpersonatedBusinessId } from '@/server/impersonation';
import { getCanonicalOrigin } from '@/lib/canonicalHost';
import {
  isCalendarSyncEnabled,
  getCalendarRedirectUri,
  signCalendarState,
  GOOGLE_CALENDAR_SCOPES,
} from '@/server/google/calendarConfig';
import { buildAuthUrl } from '@/server/google/calendarClient';
import { resolveOwnerStaffId } from '@/server/repos/calendarConnection';

export const dynamic = 'force-dynamic';

/**
 * התחלת זרימת חיבור יומן Google של הבעלים (admin-initiated).
 *
 * שער בעלות נאכף כאן במפורש: route handler אינו עובר דרך admin/layout, ולכן
 * מאמתים session + בעלות במייל (ולא getActiveBusiness שנופל לאורח). כשהפיצ׳ר
 * כבוי ב-env מפנים בחזרה להגדרות עם דגל, כדי שלא ייווצר redirect_uri_mismatch.
 *
 * מקבילות התחזות (החלטה C): אם מנהל-על "נכנס כבעל העסק" (עוגיית tc_imp תקפה,
 * getImpersonatedBusinessId כבר מאמת שהסשן הוא מנהל-על), מחברים את יומן העסק
 * המתוחזה תוך שימוש במייל הבעלים האמיתי (loginHint + resolveOwnerStaffId), כך
 * שגם חיבור ה-OAuth עוקב אחר ההתחזות.
 */
export async function GET(req: Request) {
  const origin = getCanonicalOrigin(process.env) ?? new URL(req.url).origin;
  const settingsUrl = new URL('/admin/settings', origin);

  if (!isCalendarSyncEnabled(process.env)) {
    settingsUrl.searchParams.set('calendar', 'disabled');
    return NextResponse.redirect(settingsUrl);
  }

  const redirectUri = getCalendarRedirectUri(process.env);
  if (!redirectUri) {
    settingsUrl.searchParams.set('calendar', 'config_error');
    return NextResponse.redirect(settingsUrl);
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.redirect(
      new URL('/business/login?redirect=/admin/settings', origin),
    );
  }

  // בהתחזות מנהל-על פותרים את העסק המתוחזה; אחרת את העסק של הבעלים המחובר.
  const impersonatedId = await getImpersonatedBusinessId();
  const business = impersonatedId
    ? await getBusinessById(impersonatedId)
    : (await getBusinessesOwnedByEmail(email))[0];
  if (!business) {
    return NextResponse.redirect(new URL('/admin', origin));
  }

  // בהתחזות מחייבים את מייל הבעלים האמיתי (לא של מנהל-העל); עסק ללא מייל בעלים
  // אינו ניתן לחיבור. בזרימת הבעלים הרגילה email הוא ממילא מייל הבעלים.
  const ownerEmail = business.ownerEmail ?? (impersonatedId ? null : email);
  if (!ownerEmail) {
    return NextResponse.redirect(new URL('/admin', origin));
  }

  const staffId = await resolveOwnerStaffId({
    id: business.id,
    ownerEmail,
    name: business.name,
  });

  const state = signCalendarState({ businessId: business.id, staffId });
  const authUrl = buildAuthUrl({
    redirectUri,
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
    loginHint: ownerEmail,
  });

  return NextResponse.redirect(authUrl);
}
