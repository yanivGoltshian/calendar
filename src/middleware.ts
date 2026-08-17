import { NextResponse, type NextRequest } from 'next/server';
import { canonicalRedirectTarget, getCanonicalOrigin } from '@/lib/canonicalHost';

/**
 * ריכוז ל-origin קנוני יחיד (Edge middleware).
 *
 * הרקע: האפליקציה נגישה תחת שני origins שמצביעים לאותו Container App, דומיין
 * ממותג (למשל https://torchick.duckdns.org) ו-FQDN של Azure. זרימת ה-OAuth של
 * Google מסתמכת על עוגיית PKCE (code_verifier) שנכתבת על ה-origin שבו ההתחברות
 * התחילה. אם ההתחברות מתחילה על origin אחד וה-callback נוחת על origin שני, עוגיית
 * ה-PKCE חסרה, Auth.js נכשל עם InvalidCheck ומוצג עמוד Configuration.
 *
 * הפתרון: כל בקשת GET/HEAD שמגיעה ל-host לא-קנוני מופנית (308) לאותו path+query
 * על ה-origin הקנוני, כך שההתחברות מתחילה ומסתיימת על אותו origin. ההחלטה כולה
 * מרוכזת ב-src/lib/canonicalHost.ts (טהורה וניתנת לבדיקה).
 *
 * בטוח כברירת מחדל: no-op כשאין origin קנוני מוגדר, כשה-host כבר תואם, או עבור
 * probes ושמות מארח פנימיים. ה-matcher מחריג את /api, ולכן ה-callback של Google
 * (/api/auth/callback/*) לעולם לא נחתך באמצע הזרימה. ה-origin הקנוני נגזר מ-
 * APP_CANONICAL_URL, ואם אינו מוגדר אז מ-AUTH_URL / NEXTAUTH_URL / NEXT_PUBLIC_APP_URL.
 *
 * שער הכניסה ל-/admin ול-/account נאכף בשרת (admin/layout.tsx ו-src/lib/session.ts);
 * ה-middleware הזה אינו מייבא next-auth ואינו מאמת חתימות, אלא רק מרכז origin.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const canonicalTarget = canonicalRedirectTarget({
    method: request.method,
    host: request.headers.get('host') ?? request.nextUrl.host,
    pathname,
    search,
    canonicalOrigin: getCanonicalOrigin(),
  });

  if (canonicalTarget) {
    return NextResponse.redirect(canonicalTarget, 308);
  }

  return NextResponse.next();
}

export const config = {
  // רץ על עמודים לצורך ריכוז ה-origin הקנוני, פרט ל-API, לנכסים סטטיים ולקבצי PWA.
  // החרגת /api קריטית: ה-callback של Google (/api/auth/callback/*) לעולם לא ייחתך.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|icons/|brand/|og/).*)',
  ],
};
