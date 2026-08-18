'use client';

import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';

/**
 * אתחול Firebase בצד הלקוח (אופציונלי, מגודר ב-env).
 *
 * הפיצ׳ר של אימות טלפון דרך Firebase נטען רק אם קיים NEXT_PUBLIC_FIREBASE_API_KEY.
 * כל המשתנים הם NEXT_PUBLIC_* (מוטמעים בזמן build). כשאין קונפיגורציה, `firebaseEnabled`
 * הוא false וה-UI מסתיר את מסלול הטלפון-דרך-Firebase לחלוטין — האפליקציה עולה כרגיל.
 * אין הרדקוד של מפתחות: הכול נקרא מ-env בלבד.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

/** האם אימות Firebase-טלפון זמין בצד הלקוח (מפתח ה-API מוגדר). */
export const firebaseEnabled = !!firebaseConfig.apiKey;

let app: FirebaseApp | null = null;

/** מחזיר את מופע ה-Auth של Firebase, או null אם הפיצ׳ר אינו מוגדר. */
export function getFirebaseAuth(): Auth | null {
  if (!firebaseEnabled) return null;
  if (!app) {
    app = getApps()[0] ?? initializeApp(firebaseConfig);
  }
  return getAuth(app);
}
