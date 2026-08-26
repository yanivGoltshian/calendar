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
 * מדיניות פרטי קשר לפי מסלול (`opts.requireBoth`):
 *   - ברירת מחדל / פרימיום (`requireBoth=false`): שם + לפחות אחד מבין טלפון/מייל, כך
 *     שהלקוח יכול למסור טלפון בלבד (הטבת פרימיום) ועסק מבוסס-מייל בלבד עובד גם הוא.
 *   - סטנדרט (`requireBoth=true`): שם + גם טלפון וגם מייל. שליחת SMS/וואטסאפ עולה כסף,
 *     ולכן במסלול הסטנדרט בעל העסק מקבל תמיד את הטלפון (גם אם אינו מאומת) לצד המייל
 *     (500 מיילים חינם ביום). קודי שגיאה ייעודיים: `phone_required` / `email_required`.
 *
 * משפך "אורח תחילה" (`opts.allowNoContact`): כשהעסק איפשר הזמנה ללא מספר טלפון, מותר
 * להזמין עם שם בלבד (ללא טלפון וללא מייל). במצב זה `requireBoth` נאכף כ-false.
 *
 * רמת האימות המוחזרת (`verificationStatus`) עבור אורח היא לעולם אחת משתיים:
 *   - `UNVERIFIED` — נמסר טלפון אך לא אומת (אין OTP במסלול האורח).
 *   - `NONE` — לא נמסר טלפון כלל (מותר רק כאשר `allowNoContact=true`).
 * אימות מלא (`VERIFIED`) נקבע במסלול המחובר/OTP בתוך המסלול עצמו, לא כאן.
 */

export type GuestIdentityResult =
  | { ok: true; name: string; phone?: string; email?: string; verificationStatus: 'UNVERIFIED' | 'NONE' }
  | { ok: false; error: 'bad_request' | 'invalid_phone' | 'invalid_email' | 'phone_required' | 'email_required' };

export function resolveGuestIdentity(
  name?: string,
  phone?: string,
  email?: string,
  opts?: { requireBoth?: boolean; allowNoContact?: boolean },
): GuestIdentityResult {
  const guestName = name?.trim();
  const guestPhone = phone?.trim();
  const guestEmail = email?.trim();
  const allowNoContact = opts?.allowNoContact ?? false;
  // כשמותרת הזמנה ללא טלפון, אין טעם לכפות גם טלפון וגם מייל.
  const requireBoth = allowNoContact ? false : (opts?.requireBoth ?? false);

  // שם הוא חובה בכל מסלול.
  if (!guestName) {
    return { ok: false, error: 'bad_request' };
  }

  if (requireBoth) {
    // מסלול סטנדרט: חובה גם טלפון וגם מייל.
    if (!guestPhone) return { ok: false, error: 'phone_required' };
    if (!guestEmail) return { ok: false, error: 'email_required' };
  } else if (!guestPhone && !guestEmail && !allowNoContact) {
    // מסלול פרימיום/ברירת מחדל: לפחות אחד מבין טלפון/מייל (לעולם לא שניהם כפויים).
    // חריג: במשפך "אורח תחילה" (allowNoContact) מותר גם ללא כל פרט קשר.
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

  // רמת אימות: יש טלפון → לא מאומת (UNVERIFIED); אין טלפון כלל → ללא טלפון (NONE).
  const verificationStatus: 'UNVERIFIED' | 'NONE' = outPhone ? 'UNVERIFIED' : 'NONE';

  return { ok: true, name: guestName, phone: outPhone, email: outEmail, verificationStatus };
}
