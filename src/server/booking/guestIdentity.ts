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
 * לוגיקה אמיתית (במקום שכפול). כל מזהה שסופק חייב לעבור ולידציה ומנורמל (טלפון ל-E.164,
 * מייל ל-lowercase/trim). קודי השגיאה נשמרים זהים למקור.
 *
 * מדיניות פרטי קשר לפי מסלול (`opts.requireEmail`):
 *   - שם + טלפון הם חובה בכל המסלולים (כולל סטנדרט). כך בעל העסק תמיד מקבל טלפון ליצירת
 *     קשר, וההזמנה נעשית כאורח ללא הרשמה.
 *   - מייל נדרש רק בפרימיום/אקסקלוסיב (`requireEmail=true`), שכן שם נשלח אישור הזמנה
 *     ותזכורות במייל וקיימת הרשמת לקוחות. בסטנדרט המייל אינו נאסף כלל.
 *   - קודי שגיאה ייעודיים: `phone_required` (חסר טלפון) / `email_required` (חסר מייל בפרימיום/אקסקלוסיב).
 */

export type GuestIdentityResult =
  | { ok: true; name: string; phone?: string; email?: string }
  | { ok: false; error: 'bad_request' | 'invalid_phone' | 'invalid_email' | 'phone_required' | 'email_required' };

export function resolveGuestIdentity(
  name?: string,
  phone?: string,
  email?: string,
  opts?: { requireEmail?: boolean },
): GuestIdentityResult {
  const guestName = name?.trim();
  const guestPhone = phone?.trim();
  const guestEmail = email?.trim();
  const requireEmail = opts?.requireEmail ?? false;

  // שם הוא חובה בכל מסלול.
  if (!guestName) {
    return { ok: false, error: 'bad_request' };
  }

  // טלפון הוא חובה בכל המסלולים (סטנדרט/פרימיום/אקסקלוסיב).
  if (!guestPhone) {
    return { ok: false, error: 'phone_required' };
  }

  // מייל נדרש רק בפרימיום/אקסקלוסיב (אישור/תזכורת במייל + הרשמה).
  if (requireEmail && !guestEmail) {
    return { ok: false, error: 'email_required' };
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
