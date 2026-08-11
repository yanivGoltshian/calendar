import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * הגדרת NextAuth (Auth.js v5) לכניסת בעלי עסק.
 *
 * החלטות ארכיטקטוניות:
 * - אסטרטגיית session = JWT בלבד. אין adapter ואין טבלאות auth חדשות,
 *   כדי לא לגעת במודל User (שמבוסס טלפון וחובה ל-OTP) שנמצא בבעלות סשן אחר.
 * - ספק Google מגודר ב-env: נטען רק אם קיימים GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
 *   אם אין קרדנשלס, המערכת עולה כרגיל והכפתור פשוט מוסתר ב-UI (degrade gracefully).
 * - כניסת בעלים מזוהה לפי כתובת המייל המאומתת (session.user.email), שנשמרת
 *   על Business.ownerEmail (עמודה אדיטיבית).
 */

const googleEnabled = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

/**
 * דגל מייל: תשתית ה-magic-link דורשת adapter + טבלאות VerificationToken,
 * מה שמצריך שינוי במודל User המשותף. לכן היא מגודרת ומושבתת כברירת מחדל.
 * ה-env מחווט ומתועד; הפעלה מלאה מושארת כצעד go-live נפרד.
 */
const emailEnabled = !!(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);

/** סטטוס ספקים לגזירת UI (הצגה/הסתרה של כפתורים). */
export const authProviderStatus = {
  google: googleEnabled,
  email: emailEnabled,
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
