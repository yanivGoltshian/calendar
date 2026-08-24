import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
import { getCanonicalOrigin } from '@/lib/canonicalHost';
import {
  isCalendarSyncEnabled,
  getCalendarRedirectUri,
  verifyCalendarState,
} from '@/server/google/calendarConfig';
import { exchangeCode, getUserEmail } from '@/server/google/calendarClient';
import { upsertConnection } from '@/server/repos/calendarConnection';

export const dynamic = 'force-dynamic';

/**
 * Callback של זרימת חיבור יומן Google. מאמת state חתום (CSRF), מוודא שהבעלים
 * המחובר תואם ל-businessId שב-state, מחליף code בטוקנים, שומר חיבור מוצפן,
 * ומפנה חזרה להגדרות עם דגל תוצאה. כל כשל מפנה עם calendar=<reason> ולא זורק 500.
 */
export async function GET(req: NextRequest) {
  const origin = getCanonicalOrigin(process.env) ?? new URL(req.url).origin;
  const settingsUrl = new URL('/admin/settings', origin);
  const fail = (reason: string) => {
    settingsUrl.searchParams.set('calendar', reason);
    return NextResponse.redirect(settingsUrl);
  };

  if (!isCalendarSyncEnabled(process.env)) return fail('disabled');

  const params = req.nextUrl.searchParams;
  const oauthError = params.get('error');
  if (oauthError) return fail('denied');

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return fail('missing_code');

  const parsed = verifyCalendarState(state);
  if (!parsed) return fail('state_error');

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.redirect(
      new URL('/business/login?redirect=/admin/settings', origin),
    );
  }

  const [business] = await getBusinessesOwnedByEmail(email);
  if (!business || business.id !== parsed.businessId) return fail('scope_error');

  const redirectUri = getCalendarRedirectUri(process.env);
  if (!redirectUri) return fail('config_error');

  try {
    const tokens = await exchangeCode(code, redirectUri);
    if (!tokens.refresh_token) {
      // בלי refresh token לא נוכל לרענן — מבקשים חיבור מחדש (revoke ואז לחיצה שוב).
      return fail('no_refresh');
    }
    const googleEmail = await getUserEmail(tokens.access_token);
    const accessTokenExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

    await upsertConnection({
      staffId: parsed.staffId,
      businessId: business.id,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      accessTokenExpiresAt,
      googleEmail,
    });

    return fail('connected');
  } catch {
    return fail('exchange_error');
  }
}
