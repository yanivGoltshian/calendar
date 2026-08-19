/**
 * גשר זהות לבעל עסק שנרשם בטלפון.
 *
 * זהות הבעלים במערכת מבוססת מייל: session.user.email נשמר על Business.ownerEmail,
 * וכל שכבת הבעלות (יצירת עסק, חזרה לעסק, שער הכניסה) מזהה בעלים לפי מייל. כדי
 * לאפשר הרשמת בעלים בטלפון בלי לגעת בשכבה הזו, בעל טלפון מקבל כתובת מייל
 * דטרמיניסטית הנגזרת ממספר ה-E.164 שלו, וכך המסלול הקיים עובד ללא שינוי. המספר
 * המקורי ניתן לשחזור מהכתובת.
 *
 * זהו מסלול fallback מתועד. הקשחה עתידית: עמודת Business.ownerPhone וזיהוי בעלות
 * לפי טלפון ישירות, בלי כתובת סינתטית.
 *
 * מודול טהור, ללא תלות בשרת או ב-DB, כדי שיהיה ניתן לבדיקת יחידה ישירה.
 */

/** הסיומת (domain) של כתובות מייל סינתטיות עבור בעלים שנרשמו בטלפון. */
export const PHONE_OWNER_EMAIL_DOMAIN = 'phone.torchick.local';

/**
 * גוזר כתובת מייל סינתטית דטרמיניסטית ממספר טלפון בפורמט E.164 (‎+9725XXXXXXXX).
 * למשל ‎+972501234567 יוצר 972501234567@phone.torchick.local. מחזיר null אם המספר
 * אינו בפורמט E.164 צפוי, ולכן לא ניתן לגזור ממנו זהות יציבה.
 */
export function ownerEmailForPhone(phoneE164: string): string | null {
  const trimmed = phoneE164.trim();
  if (!/^\+\d{6,15}$/.test(trimmed)) return null;
  const digits = trimmed.slice(1);
  return `${digits}@${PHONE_OWNER_EMAIL_DOMAIN}`;
}

/**
 * האם כתובת המייל היא כתובת סינתטית של בעל טלפון (ולא מייל אמיתי של בעלים).
 * משמש כדי להבחין בין בעלי מייל אמיתיים לבעלי טלפון בכל מקום שמציג זהות.
 */
export function isPhoneOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const suffix = `@${PHONE_OWNER_EMAIL_DOMAIN}`;
  if (!normalized.endsWith(suffix)) return false;
  const local = normalized.slice(0, -suffix.length);
  return /^\d{6,15}$/.test(local);
}

/** משחזר את מספר הטלפון בפורמט E.164 מכתובת מייל סינתטית, או null אם אינה כזו. */
export function phoneFromOwnerEmail(email: string | null | undefined): string | null {
  if (!isPhoneOwnerEmail(email)) return null;
  const normalized = email!.trim().toLowerCase();
  const local = normalized.slice(0, normalized.indexOf('@'));
  return `+${local}`;
}
