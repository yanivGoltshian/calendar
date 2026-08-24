import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
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

  const [business] = await getBusinessesOwnedByEmail(email);
  if (!business) {
    return NextResponse.redirect(new URL('/admin', origin));
  }

  const staffId = await resolveOwnerStaffId({
    id: business.id,
    ownerEmail: business.ownerEmail ?? email,
    name: business.name,
  });

  const state = signCalendarState({ businessId: business.id, staffId });
  const authUrl = buildAuthUrl({
    redirectUri,
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
    loginHint: business.ownerEmail ?? email,
  });

  return NextResponse.redirect(authUrl);
}
