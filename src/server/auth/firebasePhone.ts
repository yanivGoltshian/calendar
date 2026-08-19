import 'server-only';

import { isValidIsraeliMobile, normalizePhone } from '@/lib/crypto';
import { verifyFirebaseIdToken } from '@/lib/firebase/admin';

/**
 * תוצאת אימות Firebase-טלפון: מספר E.164 תקין, או סיבת כשל מובחנת.
 * הסיבות תואמות את קודי השגיאה שגשר הלקוח כבר מחזיר (401 מול 400).
 */
export type VerifyFirebasePhoneResult =
  | { ok: true; phone: string }
  | { ok: false; reason: 'invalid_token' | 'unsupported_phone' };

/**
 * מאמת Firebase ID token של אימות טלפון ומחזיר מספר נייד ישראלי בפורמט E.164.
 *
 * מרכז את רצף האימות המשותף לשני צרכנים: גשר הלקוח (client session,
 * ‎/api/auth/firebase-phone) וספק ה-Credentials 'owner-phone' של NextAuth. אינו
 * זורק: אם firebase-admin אינו מוגדר או הטוקן פסול מחזיר invalid_token, ואם המספר
 * אינו נייד ישראלי נתמך מחזיר unsupported_phone.
 */
export async function verifyFirebasePhoneIdToken(
  idToken: string,
): Promise<VerifyFirebasePhoneResult> {
  const claims = await verifyFirebaseIdToken(idToken);
  if (!claims) return { ok: false, reason: 'invalid_token' };

  const phone = normalizePhone(claims.phoneNumber);
  if (!isValidIsraeliMobile(phone)) return { ok: false, reason: 'unsupported_phone' };

  return { ok: true, phone };
}
