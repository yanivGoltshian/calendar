'use client';

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import { getFirebaseAuth } from './client';

/**
 * מסלול אימות טלפון בצד הלקוח דרך Firebase (אופציונלי, מגודר ב-env).
 *
 * הזרימה: RecaptchaVerifier (בלתי נראה) -> signInWithPhoneNumber -> confirm(code)
 * -> Firebase ID token, שנשלח לשרת לאימות עם firebase-admin.
 * כל הקוד כאן רץ רק כאשר `firebaseEnabled` (קיים NEXT_PUBLIC_FIREBASE_API_KEY).
 */

/** נרמול מספר ישראלי ל-E.164 (‎+972…) — פונקציה טהורה, ללא תלות בשרת. */
export function toE164Israel(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+972')) {
    const rest = digits.slice(4).replace(/^0+/, '');
    return rest.length === 9 ? `+972${rest}` : null;
  }
  const local = digits.replace(/^0+/, '');
  // נייד ישראלי: 5XXXXXXXX (9 ספרות שמתחילות ב-5)
  if (/^5\d{8}$/.test(local)) return `+972${local}`;
  return null;
}

let verifier: RecaptchaVerifier | null = null;

/** שולח קוד SMS דרך Firebase ומחזיר אובייקט אישור להשלמת האימות. */
export async function sendFirebasePhoneCode(
  phoneE164: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('firebase_disabled');
  if (!verifier) {
    verifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  }
  return signInWithPhoneNumber(auth, phoneE164, verifier);
}

/** איפוס מאמת ה-reCAPTCHA (למשל בעת מעבר בין מסלולים). */
export function resetFirebaseRecaptcha(): void {
  if (verifier) {
    try {
      verifier.clear();
    } catch {
      // מתעלמים — הניקוי הוא best-effort.
    }
    verifier = null;
  }
}
