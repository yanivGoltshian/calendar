import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * עוגיית התחברות חתומה ללקוח, ללא תלות חיצונית.
 * מבנה: base64url(payloadJson).base64url(hmacSha256).
 */

const SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
const COOKIE_NAME = 'client_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 ימים

export type ClientSession = {
  userId: string;
  // לפחות אחד מבין phone/email קיים. phone נשאר לתאימות לאחור עם עוגיות קיימות
  // (שתמיד כללו phone); email נוסף עבור התחברות לקוח לפי מייל.
  phone?: string;
  email?: string;
  name?: string;
  exp: number; // חותמת זמן בשניות
};

function b64urlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payload: string): string {
  return b64urlEncode(createHmac('sha256', SECRET).update(payload).digest());
}

export function serializeSession(session: ClientSession): string {
  const payload = b64urlEncode(JSON.stringify(session));
  return `${payload}.${sign(payload)}`;
}

export function parseSession(token: string | undefined): ClientSession | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(b64urlDecode(payload).toString('utf8')) as ClientSession;
    if (!session.exp || session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** קריאת ההתחברות הנוכחית מתוך העוגייה (Server Components / Actions). */
export async function getClientSession(): Promise<ClientSession | null> {
  const store = await cookies();
  return parseSession(store.get(COOKIE_NAME)?.value);
}

/** יצירת התחברות וכתיבת העוגייה. */
export async function setClientSession(
  data: Omit<ClientSession, 'exp'>,
): Promise<void> {
  const session: ClientSession = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const store = await cookies();
  store.set(COOKIE_NAME, serializeSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearClientSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
