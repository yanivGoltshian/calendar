'use client';

import { useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import type { ConfirmationResult } from 'firebase/auth';
import { t } from '@/i18n';
import { Button } from '@/components/ui';
import { sendFirebasePhoneCode, toE164Israel, resetFirebaseRecaptcha } from '@/lib/firebase/phone';

const inputClass =
  'w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sand-900 ' +
  'placeholder:text-sand-400 shadow-sm transition-colors ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/**
 * רכיב כניסת בעלים (client). שלושה מסלולים מגודרים ב-env:
 * - Google: signIn רגיל של NextAuth, עם אימות מובנה בחשבון (ללא קוד).
 * - מייל: דו-שלבי מבוסס OTP (POST /api/otp/email/request ואז ספק 'owner-email').
 * - טלפון: דו-שלבי מבוסס Firebase (reCAPTCHA + signInWithPhoneNumber, ואז ספק
 *   'owner-phone' שמאמת את ה-ID token). לשני המסלולים האחרונים נשלח קוד בן שש
 *   ספרות שיש להזין כאן. הבחירה בין מייל לטלפון מוצגת רק כששניהם מופעלים.
 */
export function OwnerSignIn({
  googleEnabled,
  emailEnabled,
  phoneEnabled,
  callbackUrl,
}: {
  googleEnabled: boolean;
  emailEnabled: boolean;
  phoneEnabled: boolean;
  callbackUrl: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<'email' | 'phone'>(emailEnabled ? 'email' : 'phone');

  // מסלול מייל.
  const [emailStage, setEmailStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');

  // מסלול טלפון (Firebase). אישור ה-SMS נשמר בין רינדורים.
  const [phoneStage, setPhoneStage] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const confirmationRef = useRef<ConfirmationResult | null>(null);

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

  async function handleEmailRequest(formData: FormData) {
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
      setEmailStage('code');
    } catch {
      setError(t.business.login.error);
    } finally {
      setPending(false);
    }
  }

  async function handleEmailVerify(formData: FormData) {
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

  async function handlePhoneRequest(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const e164 = toE164Israel(phone);
    if (!e164) {
      setError(t.business.login.phoneInvalid);
      setPending(false);
      return;
    }
    try {
      confirmationRef.current = await sendFirebasePhoneCode(e164, 'owner-recaptcha-container');
      setPhoneStage('code');
    } catch {
      setError(t.business.login.phoneError);
      resetFirebaseRecaptcha();
    } finally {
      setPending(false);
    }
  }

  async function handlePhoneVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const confirmation = confirmationRef.current;
    if (!confirmation) {
      setError(t.business.login.phoneError);
      setPending(false);
      return;
    }
    try {
      const cred = await confirmation.confirm(phoneCode.trim());
      const idToken = await cred.user.getIdToken();
      const res = await signIn('owner-phone', { idToken, redirect: false });
      if (res?.error) {
        setError(t.business.login.phoneInvalidCode);
      } else {
        window.location.assign(callbackUrl);
        return;
      }
    } catch {
      setError(t.business.login.phoneInvalidCode);
    } finally {
      setPending(false);
    }
  }

  function switchMethod(next: 'email' | 'phone') {
    setMethod(next);
    setError(null);
    setEmailStage('email');
    setPhoneStage('phone');
    setPhoneCode('');
    confirmationRef.current = null;
    resetFirebaseRecaptcha();
  }

  const showCodeSection = emailEnabled || phoneEnabled;

  return (
    <div className="space-y-4">
      {googleEnabled ? (
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={handleGoogle}
          >
            {t.business.login.google}
          </Button>
          <p className="text-center text-xs text-sand-400">{t.business.login.googleHint}</p>
        </div>
      ) : null}

      {googleEnabled && showCodeSection ? (
        <div className="flex items-center gap-3 text-xs text-sand-400">
          <span className="h-px flex-1 bg-sand-200" />
          {t.business.login.orDivider}
          <span className="h-px flex-1 bg-sand-200" />
        </div>
      ) : null}

      {emailEnabled && phoneEnabled ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => switchMethod('email')}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              method === 'email'
                ? 'border-brand-500 bg-brand-500/10 text-brand-700'
                : 'border-sand-300 text-sand-500 hover:text-sand-700'
            }`}
          >
            {t.business.login.methodEmail}
          </button>
          <button
            type="button"
            onClick={() => switchMethod('phone')}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
              method === 'phone'
                ? 'border-brand-500 bg-brand-500/10 text-brand-700'
                : 'border-sand-300 text-sand-500 hover:text-sand-700'
            }`}
          >
            {t.business.login.methodPhone}
          </button>
        </div>
      ) : null}

      {emailEnabled && method === 'email' ? (
        emailStage === 'email' ? (
          <form action={handleEmailRequest} className="space-y-3">
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
            <p className="text-xs text-sand-500">{t.business.login.emailHint}</p>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t.business.login.emailSending : t.business.login.emailSubmit}
            </Button>
          </form>
        ) : (
          <form action={handleEmailVerify} className="space-y-3">
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
                setEmailStage('email');
                setError(null);
              }}
            >
              {t.business.login.emailBack}
            </button>
            <p className="text-center text-xs text-sand-400">{t.business.login.emailDevHint}</p>
          </form>
        )
      ) : null}

      {phoneEnabled && method === 'phone' ? (
        phoneStage === 'phone' ? (
          <form onSubmit={handlePhoneRequest} className="space-y-3">
            <div>
              <label
                htmlFor="owner-phone"
                className="mb-1.5 block text-sm font-medium text-sand-800"
              >
                {t.business.login.phoneLabel}
              </label>
              <input
                id="owner-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                required
                placeholder={t.business.login.phonePlaceholder}
                className={inputClass}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <p className="text-xs text-sand-500">{t.business.login.phoneHint}</p>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t.business.login.phoneSending : t.business.login.phoneSubmit}
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePhoneVerify} className="space-y-3">
            <p className="text-sm text-green-700">{t.business.login.phoneSent}</p>
            <div>
              <label
                htmlFor="owner-phone-code"
                className="mb-1.5 block text-sm font-medium text-sand-800"
              >
                {t.business.login.phoneCodeLabel}
              </label>
              <input
                id="owner-phone-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                required
                placeholder={t.business.login.phoneCodePlaceholder}
                className={inputClass}
                value={phoneCode}
                onChange={(event) => setPhoneCode(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t.business.login.phoneVerifying : t.business.login.phoneVerify}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-sand-500 hover:text-sand-700"
              onClick={() => {
                setPhoneStage('phone');
                setError(null);
                confirmationRef.current = null;
                resetFirebaseRecaptcha();
              }}
            >
              {t.business.login.phoneBack}
            </button>
          </form>
        )
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {/* מיכל reCAPTCHA בלתי-נראה עבור אימות טלפון דרך Firebase */}
      {phoneEnabled ? <div id="owner-recaptcha-container" /> : null}
    </div>
  );
}

export default OwnerSignIn;
