import 'server-only';

import type { App } from 'firebase-admin/app';

/**
 * אימות טוקן Firebase בצד השרת (אופציונלי, מגודר ב-env).
 *
 * מאתחל את firebase-admin עם service account מתוך משתני סביבה בלבד:
 * FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY.
 * ה-import של firebase-admin הוא דינמי כדי שלא ייטען בזמן build כשאין שימוש.
 * אם ה-env חסר — verifyFirebaseIdToken מחזיר null וה-API ידחה בעדינות.
 */

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// ערך ה-env מגיע עם \n מילוליים; יש להמיר לשורות חדשות אמיתיות עבור cert init.
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

/** האם אימות Firebase-טלפון זמין בצד השרת (service account מוגדר). */
export const firebaseAdminConfigured = !!(projectId && clientEmail && privateKey);

let appPromise: Promise<App> | null = null;

async function getAdminApp(): Promise<App | null> {
  if (!firebaseAdminConfigured) return null;
  if (!appPromise) {
    appPromise = (async () => {
      const { getApps, initializeApp, cert } = await import('firebase-admin/app');
      const existing = getApps();
      if (existing.length > 0) return existing[0]!;
      return initializeApp({
        credential: cert({
          projectId: projectId!,
          clientEmail: clientEmail!,
          privateKey: privateKey!,
        }),
      });
    })();
  }
  return appPromise;
}

export type FirebasePhoneClaims = {
  uid: string;
  phoneNumber: string;
};

/**
 * מאמת Firebase ID token ומחזיר את מספר הטלפון המאומת, או null אם אינו תקין
 * או שהפיצ׳ר אינו מוגדר. אינו זורק — קורא ה-API אחראי לתשובת השגיאה.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<FirebasePhoneClaims | null> {
  const adminApp = await getAdminApp();
  if (!adminApp) return null;
  try {
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth(adminApp).verifyIdToken(idToken);
    const phoneNumber = decoded.phone_number;
    if (!phoneNumber) return null;
    return { uid: decoded.uid, phoneNumber };
  } catch {
    return null;
  }
}
