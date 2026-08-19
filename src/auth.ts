import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { isValidEmail } from '@/lib/crypto';
import { checkOtp, findOrCreateUserByEmail } from '@/server/repos/otp';
import { verifyFirebasePhoneIdToken } from '@/server/auth/firebasePhone';
import { ownerEmailForPhone } from '@/lib/ownerPhoneIdentity';
import { computeAuthProviderStatus } from '@/server/auth/providerStatus';
import { authorizeOwnerEmail } from '@/server/auth/ownerEmailAuthorize';

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

/**
 * סטטוס ספקים לגזירת UI (הצגה/הסתרה של כפתורים), נגזר ממשתני הסביבה.
 * הלוגיקה חולצה לפונקציה טהורה `computeAuthProviderStatus` (ניתנת לבדיקת יחידה):
 * - google: פעיל רק כשקיימים GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
 * - email: פעיל תמיד (ספק ה-OTP במייל כולל נפילת console כשאין EMAIL_SERVER; בפרודקשן
 *   נשלח מייל אמיתי כשמוגדרים EMAIL_SERVER + EMAIL_FROM).
 * - firebasePhone: פעיל רק כשמוגדר NEXT_PUBLIC_FIREBASE_API_KEY. הדגל משמש גם את כניסת
 *   הלקוח וגם את ספק 'owner-phone'; בעל שנרשם בטלפון מקבל מייל סינתטי דטרמיניסטי
 *   (ownerEmailForPhone) כך שזהות הבעלים נשארת מבוססת מייל ללא שינוי בשכבת הבעלות.
 */
export const authProviderStatus = computeAuthProviderStatus(process.env);

const googleEnabled = authProviderStatus.google;
const firebasePhoneEnabled = authProviderStatus.firebasePhone;

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
      // לוגיקת האימות חולצה לפונקציה טהורה עם הזרקת תלויות (ניתנת לבדיקת יחידה).
      return authorizeOwnerEmail(raw, { checkOtp, findOrCreateUserByEmail });
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
    // שגיאות אימות (למשל Configuration בחזרה מ-Google) מופנות לעמוד הכניסה עצמו,
    // שנשלט ע"י ה-middleware הקנוני — כך המשתמש רואה הודעה ברורה בעברית ומנסה שוב
    // מהמקור הקנוני (ריפוי-עצמי לפיצול origin), במקום עמוד השגיאה הכללי של Auth.js.
    error: '/business/login',
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
