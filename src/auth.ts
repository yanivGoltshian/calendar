import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { isValidEmail, normalizeEmail } from '@/lib/crypto';
import { checkOtp, findOrCreateUserByEmail } from '@/server/repos/otp';
import { verifyFirebasePhoneIdToken } from '@/server/auth/firebasePhone';
import { ownerEmailForPhone } from '@/lib/ownerPhoneIdentity';

/**
 * הגדרת NextAuth (Auth.js v5) לכניסת בעלי עסק.
 *
 * החלטות ארכיטקטוניות:
 * - אסטרטגיית session = JWT בלבד. אין adapter ואין טבלאות auth חדשות,
 *   כדי לא לגעת במודל User (המשותף לזהות לקוח) שנמצא בבעלות סשן אחר.
 * - ספק Google מגודר ב-env: נטען רק אם קיימים GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
 *   אם אין קרדנשלס, המערכת עולה כרגיל והכפתור פשוט מוסתר ב-UI (degrade gracefully).
 * - כניסת מייל לבעלים ממומשת כ-Credentials מגובה OTP (קוד בן שש ספרות שנשלח במייל),
 *   ולכן אינה דורשת adapter/VerificationToken. ה-authorize מאמת {email, code} מול
 *   אותו מנגנון OTP של הטלפון ומחזיר משתמש לפי מייל, כך נשמרת אסטרטגיית JWT-only.
 *   שליחת הקוד עצמה נעשית ב-POST /api/otp/email/request (ספק מייל עם נפילת console).
 * - כניסת בעלים מזוהה לפי כתובת המייל המאומתת (session.user.email), שנשמרת
 *   על Business.ownerEmail (עמודה אדיטיבית).
 */

const googleEnabled = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

/**
 * כניסת מייל לבעלים פעילה תמיד: ספק המייל כולל נפילת console בטוחה (רישום הקוד
 * ללוג) כשאין EMAIL_SERVER, כך שהמסלול עובד מקצה-לקצה גם בלי SMTP אמיתי, ובפרודקשן
 * נשלח מייל אמיתי כשמוגדרים EMAIL_SERVER + EMAIL_FROM.
 */
const emailEnabled = true;

/**
 * דגל Firebase Phone (אופציונלי): מוצג ב-UI רק כשמוגדר מפתח הלקוח
 * NEXT_PUBLIC_FIREBASE_API_KEY. אחרת הפיצ׳ר מוסתר לחלוטין וההתנהגות הקיימת נשמרת.
 * הדגל משמש גם את כניסת הלקוח (client session) וגם את ספק 'owner-phone' של הבעלים:
 * בעל שנרשם בטלפון מקבל כתובת מייל סינתטית דטרמיניסטית (ownerEmailForPhone), כך
 * שזהות הבעלים נשארת מבוססת מייל (Business.ownerEmail) ללא שינוי בשכבת הבעלות.
 */
const firebasePhoneEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

/** סטטוס ספקים לגזירת UI (הצגה/הסתרה של כפתורים). */
export const authProviderStatus = {
  google: googleEnabled,
  email: emailEnabled,
  firebasePhone: firebasePhoneEnabled,
};

const providers: NextAuthConfig['providers'] = [];

if (googleEnabled) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// ספק Credentials לכניסת מייל של בעלים, מגובה OTP. אינו דורש adapter ותואם JWT.
providers.push(
  Credentials({
    id: 'owner-email',
    name: 'Email code',
    credentials: {
      email: { label: 'Email', type: 'email' },
      code: { label: 'Code', type: 'text' },
    },
    async authorize(raw) {
      const email = normalizeEmail(String(raw?.email ?? ''));
      const code = String(raw?.code ?? '').trim();
      if (!isValidEmail(email) || code.length < 4) return null;

      const result = await checkOtp(email, code);
      if (!result.ok) return null;

      const user = await findOrCreateUserByEmail(email);
      return {
        id: user.id,
        email: user.email ?? email,
        name: user.name ?? undefined,
      };
    },
  })
);

// ספק Credentials לכניסת טלפון של בעלים, מגובה אימות Firebase-טלפון (מגודר ב-env).
// authorize מאמת Firebase ID token (אותו אימות שמשמש את גשר הלקוח), גוזר מהמספר
// כתובת מייל סינתטית דטרמיניסטית, ומחזיר משתמש מזוהה-מייל — כך הבעלים מקבל session
// רגיל של NextAuth (JWT, כמו Google/מייל) וזהות הבעלים נשמרת מבוססת-מייל ללא שינוי
// בשכבת הבעלות (יצירת עסק, חזרה לעסק, שער הכניסה).
if (firebasePhoneEnabled) {
  providers.push(
    Credentials({
      id: 'owner-phone',
      name: 'Phone code',
      credentials: {
        idToken: { label: 'Firebase ID token', type: 'text' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(raw) {
        const idToken = String(raw?.idToken ?? '').trim();
        if (idToken.length < 20) return null;

        const verified = await verifyFirebasePhoneIdToken(idToken);
        if (!verified.ok) return null;

        const ownerEmail = ownerEmailForPhone(verified.phone);
        if (!ownerEmail || !isValidEmail(ownerEmail)) return null;

        const name = String(raw?.name ?? '').trim() || undefined;
        const user = await findOrCreateUserByEmail(ownerEmail, name);
        return {
          id: user.id,
          email: user.email ?? ownerEmail,
          name: user.name ?? undefined,
        };
      },
    })
  );
}

export const authConfig: NextAuthConfig = {
  providers,
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  // עובד מאחורי ה-proxy של Container Apps בלי להסתמך על AUTH_URL.
  trustHost: true,
  pages: {
    signIn: '/business/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
        if (user.name) token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
