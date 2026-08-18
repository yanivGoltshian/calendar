import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * עזרי קריפטו ל-OTP וטלפונים.
 * לעולם לא שומרים את הקוד עצמו — רק hash עם "פלפל" (pepper) מהסביבה.
 */

const PEPPER = process.env.OTP_PEPPER || 'dev-pepper-change-me';

/** יצירת קוד OTP בן 6 ספרות. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** hash של קוד ה-OTP יחד עם הטלפון וה-pepper. */
export function hashOtp(code: string, phone: string): string {
  return createHash('sha256').update(`${phone}:${code}:${PEPPER}`).digest('hex');
}

/** השוואה בזמן קבוע כדי למנוע התקפות תזמון. */
export function verifyOtp(code: string, phone: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtp(code, phone), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/**
 * נרמול מספר טלפון ישראלי לפורמט E.164 (‎+972...).
 * מקבל קלט כמו "050-1234567", "0501234567", "+972501234567".
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+972')) return digits;
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return digits.startsWith('+') ? digits : `+972${digits}`;
}

/** בדיקת תקינות בסיסית של טלפון נייד ישראלי. */
export function isValidIsraeliMobile(input: string): boolean {
  const normalized = normalizePhone(input);
  return /^\+9725\d{8}$/.test(normalized);
}

/**
 * בדיקת תקינות בסיסית של כתובת מייל. לא מנסה לכסות כל מקרה קצה של RFC 5322,
 * אלא לוודא מבנה סביר של local@domain.tld עם אורך כולל תקין.
 */
export function isValidEmail(input: string): boolean {
  const email = input.trim();
  if (email.length < 3 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** נרמול כתובת מייל: קיצוץ רווחים והמרה לאותיות קטנות (מייל אינו רגיש לרישיות). */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** תצוגה ידידותית של טלפון E.164 ישראלי, למשל "050-1234567". */
export function displayPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  if (e164.startsWith('+972')) {
    const local = '0' + e164.slice(4);
    return `${local.slice(0, 3)}-${local.slice(3)}`;
  }
  return e164;
}
