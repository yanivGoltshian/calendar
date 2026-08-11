import { NextResponse, type NextRequest } from 'next/server';

/**
 * שער כניסה (Edge) ל-/admin ול-/account.
 *
 * הערה חשובה: קוד ה-middleware רץ בסביבת Edge שאין בה `node:crypto`, ולכן כאן
 * מתבצעת בדיקה גסה בלבד — נוכחות עוגיית ההתחברות ותוקף (exp) שלה. אימות החתימה
 * המלא (HMAC) נשאר תמיד בצד השרת דרך getClientSession() ב-src/lib/session.ts.
 * המטרה כאן היא להפנות מבקרים לא מחוברים אל /login לפני טעינת עמוד מוגן.
 */

const COOKIE_NAME = 'client_session';

/** פענוח base64url בטוח ל-Edge (ללא Buffer / node:crypto). */
function decodeBase64Url(input: string): string | null {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    // atob זמין בזמן ריצת Edge.
    const binary = atob(base64 + pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** בדיקה גסה: האם קיימת עוגייה עם payload תקין שטרם פג. */
function hasLiveSession(token: string | undefined): boolean {
  if (!token) return false;
  const payload = token.split('.')[0];
  if (!payload) return false;
  const json = decodeBase64Url(payload);
  if (!json) return false;
  try {
    const session = JSON.parse(json) as { exp?: number };
    if (!session.exp || session.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (hasLiveSession(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  const { pathname, search } = request.nextUrl;
  loginUrl.searchParams.set('redirect', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
