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
 * מדיניות פרטי קשר — שני מנגנונים משלימים:
 *   1. `opts.requireBoth` (מדור-קודם): שם + גם טלפון וגם מייל. נשמר לתאימות לאחור.
 *   2. שערים מפורשים ובלתי-תלויים `opts.requirePhone` / `opts.requireEmail`: הבעלים קובע
 *      נפרדות אילו שדות חובה, מנותק מהמסלול (basic/premium). כך ניתן לבטא גם "מייל חובה,
 *      טלפון רשות" — צירוף שלא ניתן לביטוי ב-`requireBoth` בלבד. קודי שגיאה ייעודיים:
 *      `phone_required` / `email_required`.
 *   כשלא נדרש אף שדה מפורשות (וללא `requireBoth`), נשמרת התנהגות מדור-קודם: שם + לפחות
 *   אחד מבין טלפון/מייל, אלא אם `allowNoContact` מתיר גם ללא כל פרט קשר.
 *
 * משפך "אורח תחילה" (`opts.allowNoContact`): כשהעסק איפשר הזמנה ללא מספר טלפון, מותר
 * להזמין עם שם בלבד (ללא טלפון וללא מייל). במצב זה `requireBoth` נאכף כ-false, אך
 * `requireEmail` נשאר בתוקף — עסק יכול לדרוש מייל גם כאשר הטלפון רשות.
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
  opts?: { requireBoth?: boolean; requirePhone?: boolean; requireEmail?: boolean; allowNoContact?: boolean },
): GuestIdentityResult {
  const guestName = name?.trim();
  const guestPhone = phone?.trim();
  const guestEmail = email?.trim();
  const allowNoContact = opts?.allowNoContact ?? false;
  // כשמותרת הזמנה ללא טלפון, אין טעם לכפות גם טלפון וגם מייל (requireBoth).
  const requireBoth = allowNoContact ? false : (opts?.requireBoth ?? false);
  // שערי פרטי קשר מפורשים ובלתי-תלויים לפי הגדרות הבעלים. requireEmail אינו מושפע
  // מ-allowNoContact — עסק יכול לדרוש מייל גם כשהטלפון רשות.
  const requirePhone = opts?.requirePhone ?? false;
  const requireEmail = opts?.requireEmail ?? false;

  // שם הוא חובה בכל מסלול.
  if (!guestName) {
    return { ok: false, error: 'bad_request' };
  }

  if (requireBoth) {
    // מסלול מדור-קודם: חובה גם טלפון וגם מייל.
    if (!guestPhone) return { ok: false, error: 'phone_required' };
    if (!guestEmail) return { ok: false, error: 'email_required' };
  } else {
    // שערים מפורשים לפי הגדרות הבעלים.
    if (requirePhone && !guestPhone) return { ok: false, error: 'phone_required' };
    if (requireEmail && !guestEmail) return { ok: false, error: 'email_required' };
    // כשאין דרישת שדה מפורשת, נשמרת התנהגות מדור-קודם: לפחות פרט קשר אחד,
    // אלא אם משפך "אורח תחילה" (allowNoContact) מתיר גם ללא כל פרט.
    if (!requirePhone && !requireEmail && !guestPhone && !guestEmail && !allowNoContact) {
      return { ok: false, error: 'bad_request' };
    }
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
