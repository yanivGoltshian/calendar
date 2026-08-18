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
 * רכיב כניסת בעלים (client).
 * Google מריץ signIn רגיל של NextAuth. מסלול המייל הוא דו-שלבי מבוסס OTP:
 * שליחת קוד ל-POST /api/otp/email/request ואז אימות דרך ספק ה-Credentials
 * 'owner-email' של NextAuth (JWT, ללא adapter). שני המסלולים מגודרים ב-env.
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
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');

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

  async function handleRequest(formData: FormData) {
    setError(null);
    setPending(true);
    const value = String(formData.get('email') ?? '').trim();
    try {
      const res = await fetch('/api/otp/email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) {
        setError(t.business.login.error);
        return;
      }
      setEmail(value);
      setStage('code');
    } catch {
      setError(t.business.login.error);
    } finally {
      setPending(false);
    }
  }

  async function handleVerify(formData: FormData) {
    setError(null);
    setPending(true);
    const code = String(formData.get('code') ?? '').trim();
    try {
      const res = await signIn('owner-email', { email, code, redirect: false });
      if (res?.error) {
        setError(t.business.login.emailInvalidCode);
      } else {
        window.location.assign(callbackUrl);
        return;
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
        stage === 'email' ? (
          <form action={handleRequest} className="space-y-3">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-sand-800">
                {t.business.login.emailLabel}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={t.business.login.emailPlaceholder}
                className={inputClass}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t.business.login.emailSending : t.business.login.emailSubmit}
            </Button>
          </form>
        ) : (
          <form action={handleVerify} className="space-y-3">
            <p className="text-sm text-green-700">{t.business.login.emailSent}</p>
            <div>
              <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-sand-800">
                {t.business.login.emailCodeLabel}
              </label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder={t.business.login.emailCodePlaceholder}
                className={inputClass}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t.business.login.emailVerifying : t.business.login.emailVerify}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-sand-500 hover:text-sand-700"
              onClick={() => {
                setStage('email');
                setError(null);
              }}
            >
              {t.business.login.emailBack}
            </button>
            <p className="text-center text-xs text-sand-400">{t.business.login.emailDevHint}</p>
          </form>
        )
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default OwnerSignIn;
