/**
 * מדיניות הגבלת הקצב של בקשות OTP - לוגיקה טהורה בלבד (ללא DB).
 *
 * מופרד מ-rateLimit.ts כדי שההכרעה והתצורה יהיו ניתנות לבדיקה וליבוא
 * ללא תלות ב-Prisma. rateLimit.ts מייצא מחדש מכאן ומוסיף את שכבת ה-DB.
 *
 * ניתן לדרוס את הברירות מחדל דרך משתני סביבה:
 *   OTP_COOLDOWN_SECONDS       (ברירת מחדל 60)
 *   OTP_MAX_PER_PHONE_PER_DAY  (ברירת מחדל 8)
 *   OTP_MAX_PER_IP_PER_DAY     (ברירת מחדל 30)
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface RateLimitConfig {
  cooldownSeconds: number;
  phoneDailyCap: number;
  ipDailyCap: number;
  windowMs: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** קריאת תצורת הגבלת הקצב ממשתני הסביבה, עם ברירות מחדל בטוחות. */
export function getRateLimitConfig(
  env: Record<string, string | undefined> = process.env,
): RateLimitConfig {
  return {
    cooldownSeconds: parsePositiveInt(env.OTP_COOLDOWN_SECONDS, 60),
    phoneDailyCap: parsePositiveInt(env.OTP_MAX_PER_PHONE_PER_DAY, 8),
    ipDailyCap: parsePositiveInt(env.OTP_MAX_PER_IP_PER_DAY, 30),
    windowMs: DAY_MS,
  };
}

export type RateLimitReason = 'cooldown' | 'phone_cap' | 'ip_cap';

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; reason: RateLimitReason; retryAfterSeconds: number };

export interface RateLimitInput {
  now: number;
  /** חותמת הזמן של הבקשה האחרונה לאותו טלפון (ms), אם קיימת. */
  lastPhoneSentAt: number | null;
  /** מספר הבקשות לאותו טלפון בחלון הזמן. */
  phoneCountInWindow: number;
  /** מספר הבקשות מאותו IP בחלון הזמן. */
  ipCountInWindow: number;
  config: RateLimitConfig;
}

function retryAfterForWindow(config: RateLimitConfig): number {
  // הצעת המתנה שמרנית עד להתפנות מקום בחלון היומי.
  return Math.max(60, Math.ceil(config.windowMs / 1000 / config.phoneDailyCap));
}

/**
 * הכרעה טהורה של הגבלת הקצב. אינה ניגשת ל-DB או לזמן חיצוני, ולכן ניתנת
 * לבדיקה מלאה. סדר הבדיקות: קול-דאון לטלפון, ואז תקרת טלפון, ואז תקרת IP.
 */
export function evaluateOtpRateLimit(input: RateLimitInput): RateLimitDecision {
  const { now, lastPhoneSentAt, phoneCountInWindow, ipCountInWindow, config } = input;

  if (lastPhoneSentAt !== null) {
    const elapsedSeconds = (now - lastPhoneSentAt) / 1000;
    if (elapsedSeconds < config.cooldownSeconds) {
      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterSeconds: Math.max(1, Math.ceil(config.cooldownSeconds - elapsedSeconds)),
      };
    }
  }

  if (phoneCountInWindow >= config.phoneDailyCap) {
    return { allowed: false, reason: 'phone_cap', retryAfterSeconds: retryAfterForWindow(config) };
  }

  if (ipCountInWindow >= config.ipDailyCap) {
    return { allowed: false, reason: 'ip_cap', retryAfterSeconds: retryAfterForWindow(config) };
  }

  return { allowed: true };
}
