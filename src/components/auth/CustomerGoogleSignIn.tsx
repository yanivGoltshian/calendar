'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { t } from '@/i18n';

/**
 * כפתור כניסת לקוח עם גוגל (client). זמין בכל המסלולים ואינו מגודר בחבילה.
 *
 * ההתחברות היא signIn רגיל של NextAuth (אותו דפוס כמו כניסת הבעלים ב-OwnerSignIn),
 * אבל ה-callbackUrl תמיד מפנה לגשר הזהות /account/continue. הגשר הופך את סשן גוגל
 * לעוגיית לקוח, מפנה בעלים לזרימת הבעלים ללא שינוי, ולקוח ליעד המבוקש (next).
 *
 * הרכיב הוא ניטרלי בעיצוב: className מאפשר התאמה לכל משטח (עמוד עסק, הזמנה, הצעת מחיר).
 */
export function CustomerGoogleSignIn({
  callbackUrl,
  className,
}: {
  callbackUrl: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  async function handleGoogle() {
    setPending(true);
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={pending}
      className={
        className ??
        'flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60'
      }
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
        />
      </svg>
      {t.account.googleCta}
    </button>
  );
}

export default CustomerGoogleSignIn;
