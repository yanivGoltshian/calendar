import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * הצפנה סימטרית (AES-256-GCM) לטוקנים רגישים — refresh/access tokens של Google Calendar.
 *
 * מדוע: טוקן ה-refresh של Google מעניק גישה מתמשכת ליומן בעל העסק, ולכן אסור לשמור
 * אותו בטקסט גלוי במסד. כאן מצפינים אותו לפני כתיבה ומפענחים רק בזמן שימוש בשרת.
 *
 * מפתח: נגזר ב-SHA-256 ממשתנה סביבה (32 בייט קבועים). סדר עדיפות:
 *   CALENDAR_TOKEN_SECRET → NEXTAUTH_SECRET → AUTH_SECRET → SESSION_SECRET → OTP_PEPPER.
 * בפרוד קיים SESSION_SECRET, כך שהמפתח יציב בין הפעלות (הפענוח תמיד יצליח).
 *
 * פורמט ה-ciphertext: "iv:tag:data" — שלושה חלקים ב-base64, מופרדים בנקודתיים.
 */

const KEY_SOURCE =
  process.env.CALENDAR_TOKEN_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.OTP_PEPPER ||
  'dev-calendar-token-secret-change-me';

// מפתח 256-ביט יציב הנגזר מהסוד. גזירה חד-פעמית בטעינת המודול.
const KEY = createHash('sha256').update(KEY_SOURCE).digest();

/** הצפנת מחרוזת רגישה. מחזיר "iv:tag:data" ב-base64. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12); // GCM: nonce בן 96 ביט
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** פענוח מחרוזת שהוצפנה ב-encryptToken. זורק אם ה-ciphertext פגום או המפתח שגוי. */
export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('invalid_ciphertext_format');
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
