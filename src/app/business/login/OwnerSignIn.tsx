'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { t } from '@/i18n';
import { Button } from '@/components/ui';

const inputClass =
  'w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sand-900 ' +
  'placeholder:text-sand-400 shadow-sm transition-colors ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/**
 * רכיב כניסת בעלים (client). מריץ signIn של NextAuth.
 * Google הוא המסלול הפעיל; טופס המייל מגודר ומוצג רק אם הספק מופעל ב-env.
 */
export function OwnerSignIn({
  googleEnabled,
  emailEnabled,
  callbackUrl,
}: {
  googleEnabled: boolean;
  emailEnabled: boolean;
  callbackUrl: string;
}) {
  const [pending, setPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    setPending(true);
    try {
      await signIn('google', { callbackUrl });
    } catch {
      setError(t.business.login.error);
      setPending(false);
    }
  }

  async function handleEmail(formData: FormData) {
    setError(null);
    setPending(true);
    const email = String(formData.get('email') ?? '').trim();
    try {
      const res = await signIn('email', { email, callbackUrl, redirect: false });
      if (res?.error) {
        setError(t.business.login.error);
      } else {
        setEmailSent(true);
      }
    } catch {
      setError(t.business.login.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {googleEnabled ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={handleGoogle}
        >
          {t.business.login.google}
        </Button>
      ) : null}

      {googleEnabled && emailEnabled ? (
        <div className="flex items-center gap-3 text-xs text-sand-400">
          <span className="h-px flex-1 bg-sand-200" />
          {t.business.login.orDivider}
          <span className="h-px flex-1 bg-sand-200" />
        </div>
      ) : null}

      {emailEnabled ? (
        emailSent ? (
          <p className="text-sm text-green-700">{t.business.login.emailSent}</p>
        ) : (
          <form action={handleEmail} className="space-y-3">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-sand-800">
                {t.business.login.emailLabel}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder={t.business.login.emailPlaceholder}
                className={inputClass}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t.business.login.emailSending : t.business.login.emailSubmit}
            </Button>
          </form>
        )
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default OwnerSignIn;
