import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getCanonicalOrigin } from '@/lib/canonicalHost';

/**
 * תצורת מודול סנכרון יומן Google לבעל העסק.
 *
 * שער env: הפיצ'ר כבוי כברירת מחדל (GOOGLE_CALENDAR_SYNC_ENABLED). כך כפתור החיבור
 * לא מוצג בפרוד עד שכתובת ה-redirect נרשמת ב-Google Cloud Console, ואין סיכון של
 * redirect_uri_mismatch מול משתמשים אמיתיים. ההפעלה מתבצעת בעתיד על ידי הפיכת הדגל.
 */

type EnvLike = Record<string, string | undefined>;

const REDIRECT_PATH = '/admin/calendar/google/callback';

// טווח סקופים: קריאת freeBusy (ייבוא עומס) + ניהול אירועים (ייצוא תורים).
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'openid',
  'email',
].join(' ');

export type CalendarSyncStatus = {
  /** הדגל GOOGLE_CALENDAR_SYNC_ENABLED דלוק. */
  enabled: boolean;
  /** קיימים GOOGLE_CLIENT_ID ו-GOOGLE_CLIENT_SECRET. */
  credentials: boolean;
  /** מוכן לשימוש בפועל (גם דגל וגם קרדנציאלס). */
  ready: boolean;
};

function truthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

/** סטטוס מלא לתצוגה בממשק הניהול ולגייטינג. */
export function computeCalendarSyncStatus(env: EnvLike = process.env): CalendarSyncStatus {
  const enabled = truthy(env.GOOGLE_CALENDAR_SYNC_ENABLED);
  const credentials = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  return { enabled, credentials, ready: enabled && credentials };
}

/** גייט מהיר לנתיב החם (ללא גישה ל-DB) — בשימוש בייבוא/ייצוא. */
export function isCalendarSyncEnabled(env: EnvLike = process.env): boolean {
  return computeCalendarSyncStatus(env).ready;
}

/** כתובת ה-redirect המלאה שיש לרשום ב-Google Console. null אם אין origin קנוני. */
export function getCalendarRedirectUri(env: EnvLike = process.env): string | null {
  const origin = getCanonicalOrigin(env);
  if (!origin) return null;
  return `${origin}${REDIRECT_PATH}`;
}

// ── חתימת state ל-OAuth (הגנת CSRF) ─────────────────────────────────────────

const STATE_SECRET =
  process.env.CALENDAR_TOKEN_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.OTP_PEPPER ||
  'dev-calendar-state-secret-change-me';

// תוקף חתימת ה-state: 15 דקות. מספיק לזרימת הסכמה, קצר מספיק לצמצום סיכון.
const STATE_TTL_MS = 15 * 60 * 1000;

export type CalendarOAuthState = {
  businessId: string;
  staffId: string;
};

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hmac(data: string): string {
  return b64url(createHmac('sha256', STATE_SECRET).update(data).digest());
}

/**
 * יוצר state חתום: base64url(json).timestamp.nonce.signature.
 * ה-json כולל businessId+staffId; ה-signature חותם על שלושת החלקים הראשונים.
 */
export function signCalendarState(payload: CalendarOAuthState): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const ts = Date.now().toString(36);
  const nonce = b64url(randomBytes(9));
  const base = `${body}.${ts}.${nonce}`;
  return `${base}.${hmac(base)}`;
}

/** מאמת state חתום ובתוקף. מחזיר את ה-payload או null אם לא תקין / פג תוקף. */
export function verifyCalendarState(state: string | null | undefined): CalendarOAuthState | null {
  if (!state) return null;
  const parts = state.split('.');
  if (parts.length !== 4) return null;
  const [body, ts, nonce, sig] = parts;
  const base = `${body}.${ts}.${nonce}`;
  const expected = hmac(base);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  const issuedAt = parseInt(ts, 36);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > STATE_TTL_MS) return null;

  try {
    const json = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const parsed = JSON.parse(json) as CalendarOAuthState;
    if (!parsed?.businessId || !parsed?.staffId) return null;
    return parsed;
  } catch {
    return null;
  }
}
