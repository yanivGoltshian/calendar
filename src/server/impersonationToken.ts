import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * אסימון התחזות חתום למנהל-על — לוגיקה טהורה, ללא תלות במסגרת (crypto בלבד).
 *
 * מבנה: base64url(payloadJson).base64url(hmacSha256) — זהה בתבנית לעוגיית ההתחברות
 * (‎src/lib/session.ts) ולמצב ה-OAuth של יומן גוגל, כדי לא להמציא הצפנה חדשה.
 *
 * החתימה (HMAC-SHA256) חוסמת זיוף/שינוי; exp אוכף תוקף; nonce מבטיח ייחודיות בין
 * אסימונים. הפרדת הלוגיקה הטהורה כאן (ללא next/headers ו-auth) מאפשרת בדיקת יחידה.
 */

/** שרשרת סודות — מיושרת לעוגיית ההתחברות ולסוד מצב ה-OAuth של יומן גוגל. */
export const IMPERSONATION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.CALENDAR_TOKEN_SECRET ||
  'dev-impersonation-secret-change-me';

/** תוקף ברירת המחדל של אסימון התחזות: 8 שעות (בשניות). */
export const IMPERSONATION_TTL_SECONDS = 8 * 60 * 60;

export type ImpersonationToken = {
  /** מזהה העסק שאליו מתחזה מנהל-העל. */
  businessId: string;
  /** פקיעת תוקף בשניות (Unix). */
  exp: number;
  /** ערך אקראי — ייחודיות בין אסימונים (defense-in-depth). */
  nonce: string;
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

function sign(payload: string, secret: string): string {
  return b64urlEncode(createHmac('sha256', secret).update(payload).digest());
}

export type SignImpersonationOptions = {
  /** סוד לחתימה (ברירת מחדל: שרשרת הסודות). מוזרק בבדיקות. */
  secret?: string;
  /** זמן "עכשיו" באלפיות שנייה (ברירת מחדל: Date.now()). מוזרק בבדיקות. */
  nowMs?: number;
  /** תוקף בשניות (ברירת מחדל: 8 שעות). */
  ttlSeconds?: number;
  /** nonce קבוע (ברירת מחדל: אקראי). מוזרק בבדיקות לדטרמיניזם. */
  nonce?: string;
};

/** חותם ערך אסימון התחזות עבור businessId. פונקציה טהורה — הזרקת סוד/זמן לבדיקות. */
export function signImpersonationValue(
  businessId: string,
  opts: SignImpersonationOptions = {},
): string {
  const secret = opts.secret ?? IMPERSONATION_SECRET;
  const nowMs = opts.nowMs ?? Date.now();
  const ttl = opts.ttlSeconds ?? IMPERSONATION_TTL_SECONDS;
  const nonce = opts.nonce ?? b64urlEncode(randomBytes(9));
  const token: ImpersonationToken = {
    businessId,
    exp: Math.floor(nowMs / 1000) + ttl,
    nonce,
  };
  const payload = b64urlEncode(JSON.stringify(token));
  return `${payload}.${sign(payload, secret)}`;
}

export type VerifyImpersonationOptions = {
  /** סוד לאימות (ברירת מחדל: שרשרת הסודות). מוזרק בבדיקות. */
  secret?: string;
  /** זמן "עכשיו" באלפיות שנייה (ברירת מחדל: Date.now()). מוזרק בבדיקות. */
  nowMs?: number;
};

/**
 * מאמת ערך אסימון התחזות: בודק חתימה (timingSafeEqual) ותוקף (exp).
 * מחזיר את האסימון המפוענח, או null אם חסר/מזויף/פג-תוקף/פגום. פונקציה טהורה.
 */
export function verifyImpersonationValue(
  raw: string | null | undefined,
  opts: VerifyImpersonationOptions = {},
): ImpersonationToken | null {
  if (!raw) return null;
  const secret = opts.secret ?? IMPERSONATION_SECRET;
  const nowMs = opts.nowMs ?? Date.now();
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const token = JSON.parse(b64urlDecode(payload).toString('utf8')) as ImpersonationToken;
    if (!token || typeof token.businessId !== 'string' || token.businessId.length === 0) {
      return null;
    }
    if (typeof token.exp !== 'number' || token.exp * 1000 <= nowMs) return null;
    return token;
  } catch {
    return null;
  }
}

/**
 * מחליט את מזהה העסק האפקטיבי להתחזות — פונקציה טהורה וניתנת לבדיקה.
 * העוגייה נכנסת לתוקף אך ורק כאשר הסשן הנוכחי הוא מנהל-על; אחרת מוחזר null,
 * כך שאסימון גנוב/מזויף בסשן שאינו מנהל-על לעולם אינו מקנה גישה.
 */
export function resolveImpersonatedBusinessId(input: {
  token: ImpersonationToken | null;
  isPlatformAdmin: boolean;
}): string | null {
  if (!input.isPlatformAdmin) return null;
  return input.token?.businessId ?? null;
}
