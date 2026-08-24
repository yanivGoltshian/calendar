'use client';

import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ConfirmationResult } from 'firebase/auth';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { Card, CardBody, Button, Input } from '@/components/ui/admin';
import { firebaseEnabled } from '@/lib/firebase/client';
import { sendFirebasePhoneCode, toE164Israel } from '@/lib/firebase/phone';
import { CustomerGoogleSignIn } from '@/components/auth/CustomerGoogleSignIn';

type Step = 'contact' | 'code';
type Channel = 'phone' | 'email';

export default function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/account';

  const [channel, setChannel] = useState<Channel>('phone');
  const [step, setStep] = useState<Step>('contact');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // אישור Firebase (מסלול טלפון דרך Google), נשמר בין רינדורים.
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const usingFirebasePhone = firebaseEnabled && channel === 'phone';

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (channel === 'email') {
        const res = await fetch('/api/otp/email/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error === 'invalid_email' ? t.auth.invalidEmail : t.auth.error);
          return;
        }
        setStep('code');
        return;
      }

      if (usingFirebasePhone) {
        const e164 = toE164Israel(phone);
        if (!e164) {
          setError(t.auth.invalidPhone);
          return;
        }
        try {
          confirmationRef.current = await sendFirebasePhoneCode(e164, 'recaptcha-container');
          setStep('code');
        } catch {
          setError(t.auth.firebaseError);
        }
        return;
      }

      const res = await fetch('/api/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error === 'invalid_phone' ? t.auth.invalidPhone : t.auth.error);
        return;
      }
      setStep('code');
    } catch {
      setError(t.auth.error);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (channel === 'email') {
        const res = await fetch('/api/otp/email/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, name: name.trim() || undefined }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(t.auth.invalidCode);
          return;
        }
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      if (usingFirebasePhone) {
        const confirmation = confirmationRef.current;
        if (!confirmation) {
          setError(t.auth.firebaseError);
          return;
        }
        try {
          const cred = await confirmation.confirm(code);
          const idToken = await cred.user.getIdToken();
          const res = await fetch('/api/auth/firebase-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken, name: name.trim() || undefined }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            setError(t.auth.firebaseError);
            return;
          }
          router.replace(redirectTo);
          router.refresh();
        } catch {
          setError(t.auth.invalidCode);
        }
        return;
      }

      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(t.auth.invalidCode);
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(t.auth.error);
    } finally {
      setLoading(false);
    }
  }

  function switchChannel(next: Channel) {
    setChannel(next);
    setStep('contact');
    setError(null);
    setCode('');
    confirmationRef.current = null;
  }

  const contactLabel = channel === 'email' ? t.auth.emailSentTo : t.auth.codeSentTo;
  const contactValue = channel === 'email' ? email : phone;

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col gap-5">
        <div className="text-center">
          <p className="text-lg font-bold text-[#F2D695]">{BRAND.name}</p>
          <h1 className="mt-1 text-base font-semibold text-slate-100">
            {step === 'contact'
              ? channel === 'email'
                ? t.auth.emailTitle
                : t.auth.phoneTitle
              : t.auth.codeTitle}
          </h1>
          {step === 'code' ? (
            <p className="mt-1 text-sm text-slate-400">
              {contactLabel} {contactValue}
            </p>
          ) : null}
        </div>

        {step === 'contact' ? (
          <>
            {googleEnabled ? (
              <div className="flex flex-col gap-3">
                <CustomerGoogleSignIn
                  callbackUrl={`/account/continue?next=${encodeURIComponent(redirectTo)}`}
                />
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="h-px flex-1 bg-slate-700" />
                  {t.auth.orDivider}
                  <span className="h-px flex-1 bg-slate-700" />
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => switchChannel('phone')}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  channel === 'phone'
                    ? 'border-[#F2D695] bg-[#F2D695]/10 text-[#F2D695]'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                {t.auth.methodPhone}
              </button>
              <button
                type="button"
                onClick={() => switchChannel('email')}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  channel === 'email'
                    ? 'border-[#F2D695] bg-[#F2D695]/10 text-[#F2D695]'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                {t.auth.methodEmail}
              </button>
            </div>

            <form onSubmit={requestCode} className="flex flex-col gap-4">
              {channel === 'email' ? (
                <Input
                  name="email"
                  label={t.auth.emailLabel}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  placeholder={t.auth.emailPlaceholder}
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  required
                />
              ) : (
                <Input
                  name="phone"
                  label={t.auth.phoneLabel}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder={t.auth.phonePlaceholder}
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value)}
                  required
                />
              )}
              {usingFirebasePhone ? (
                <p className="text-xs text-slate-500">{t.auth.firebasePhoneHint}</p>
              ) : null}
              {error ? <p className="text-sm text-[#F2B8B8]">{error}</p> : null}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? t.auth.sending : t.auth.sendCode}
              </Button>
            </form>
          </>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
            <Input
              name="code"
              label={t.auth.codeLabel}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              value={code}
              onChange={(ev) => setCode(ev.target.value)}
              required
            />
            <Input
              name="name"
              label={t.auth.nameLabel}
              type="text"
              autoComplete="name"
              placeholder={t.auth.namePlaceholder}
              value={name}
              onChange={(ev) => setName(ev.target.value)}
            />
            {error ? <p className="text-sm text-[#F2B8B8]">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t.auth.verifying : t.auth.verify}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('contact');
                  setError(null);
                }}
                className="text-slate-400 transition hover:text-[#F2D695]"
              >
                {t.auth.back}
              </button>
              <button
                type="button"
                onClick={requestCode}
                disabled={loading}
                className="text-slate-400 transition hover:text-[#F2D695] disabled:opacity-50"
              >
                {t.auth.resend}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-slate-500">{t.auth.devHint}</p>
        {/* מיכל reCAPTCHA בלתי-נראה עבור אימות טלפון דרך Firebase */}
        <div id="recaptcha-container" />
      </CardBody>
    </Card>
  );
}
