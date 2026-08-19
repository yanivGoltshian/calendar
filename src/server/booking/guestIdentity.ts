import {
  isValidIsraeliMobile,
  normalizePhone,
  isValidEmail,
  normalizeEmail,
} from '@/lib/crypto';

/**
 * חוקת זהות אורח עבור מסלול ההזמנה `POST /api/book`.
 *
 * חולץ מ-`src/app/api/book/route.ts` לפונקציה טהורה כדי שהמסלול והמבחן יחלקו את אותה
 * לוגיקה אמיתית (במקום שכפול). הכלל: שם + לפחות אחד מבין טלפון/מייל (לעולם לא כופים
 * את שניהם), כך שעסק מבוסס-מייל בלבד עובד מקצה-לקצה. כל מזהה שסופק חייב לעבור ולידציה
 * ומנורמל (טלפון ל-E.164, מייל ל-lowercase/trim). קודי השגיאה נשמרים זהים למקור.
 */

export type GuestIdentityResult =
  | { ok: true; name: string; phone?: string; email?: string }
  | { ok: false; error: 'bad_request' | 'invalid_phone' | 'invalid_email' };

export function resolveGuestIdentity(
  name?: string,
  phone?: string,
  email?: string,
): GuestIdentityResult {
  const guestName = name?.trim();
  const guestPhone = phone?.trim();
  const guestEmail = email?.trim();

  // שם + לפחות אחד מבין טלפון/מייל (לעולם לא שניהם כפויים).
  if (!guestName || (!guestPhone && !guestEmail)) {
    return { ok: false, error: 'bad_request' };
  }

  let outPhone: string | undefined;
  let outEmail: string | undefined;

  if (guestPhone) {
    if (!isValidIsraeliMobile(guestPhone)) return { ok: false, error: 'invalid_phone' };
    outPhone = normalizePhone(guestPhone);
  }

  if (guestEmail) {
    if (!isValidEmail(guestEmail)) return { ok: false, error: 'invalid_email' };
    outEmail = normalizeEmail(guestEmail);
  }

  return { ok: true, name: guestName, phone: outPhone, email: outEmail };
}
