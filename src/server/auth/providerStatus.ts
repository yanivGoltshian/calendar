/**
 * גזירת סטטוס ספקי הכניסה של בעלי העסק מתוך משתני הסביבה (env).
 *
 * חולץ מ-`src/auth.ts` לפונקציה טהורה כדי שיהיה ניתן לבדיקה ישירה (unit test)
 * בלי לטעון את NextAuth כולו. אין כאן שינוי התנהגות: הכללים זהים למקור.
 *
 * כללים:
 * - google: פעיל רק כשקיימים גם `GOOGLE_CLIENT_ID` וגם `GOOGLE_CLIENT_SECRET`.
 * - email: פעיל תמיד (ספק ה-OTP במייל כולל נפילת console כשאין SMTP).
 * - firebasePhone: פעיל רק כשמוגדר `NEXT_PUBLIC_FIREBASE_API_KEY`.
 */

export type AuthProviderStatus = {
  google: boolean;
  email: boolean;
  firebasePhone: boolean;
};

export type AuthProviderEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  NEXT_PUBLIC_FIREBASE_API_KEY?: string;
  // חתימת אינדקס כדי ש-`process.env` (ProcessEnv) יהיה בר-השמה ישירות.
  [key: string]: string | undefined;
};

export function computeAuthProviderStatus(env: AuthProviderEnv): AuthProviderStatus {
  return {
    google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    email: true,
    firebasePhone: !!env.NEXT_PUBLIC_FIREBASE_API_KEY,
  };
}
