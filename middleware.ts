import { NextResponse, type NextRequest } from 'next/server';

/**
 * שער כניסה (Edge) ל-/admin ול-/account.
 *
 * שתי זהויות נפרדות:
 * - /account (לקוח מזמין): עוגיית client_session חתומה-HMAC. בדיקה גסה בלבד
 *   ב-Edge (נוכחות + תוקף), אימות החתימה המלא נשאר בשרת (src/lib/session.ts).
 *   לא מחובר -> /login (כניסת לקוחות).
 * - /admin (בעל עסק): עוגיית session של NextAuth (JWT). כאן בודקים נוכחות בלבד;
 *   שער הבעלות המלא (auth() + בעלות על עסק) נאכף ב-admin/layout.tsx.
 *   לא מחובר -> /business/login (כניסת בעלים).
 *
 * ה-middleware לא מייבא next-auth (תאימות Edge) ולא מאמת חתימות — רק ניתוב מקדים.
 */

const CLIENT_COOKIE = 'client_session';
const OWNER_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

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

/** בדיקה גסה: האם קיימת עוגיית לקוח עם payload תקין שטרם פג. */
function hasLiveClientSession(token: string | undefined): boolean {
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

/** נוכחות עוגיית session של NextAuth (בעלים). אימות מלא נאכף בשרת. */
function hasOwnerSessionCookie(request: NextRequest): boolean {
  return OWNER_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // אזור הבעלים: /admin -> כניסת בעלים (NextAuth).
  if (pathname.startsWith('/admin')) {
    if (hasOwnerSessionCookie(request)) {
      return NextResponse.next();
    }
    const ownerLogin = new URL('/business/login', request.url);
    ownerLogin.searchParams.set('redirect', `${pathname}${search}`);
    return NextResponse.redirect(ownerLogin);
  }

  // אזור הלקוח: /account -> כניסת לקוחות (client_session).
  const token = request.cookies.get(CLIENT_COOKIE)?.value;
  if (hasLiveClientSession(token)) {
    return NextResponse.next();
  }
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
