'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { Card, CardBody, Button, Input } from '@/components/ui/admin';

type Step = 'phone' | 'code';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/account';

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
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

  return (
    <Card className="w-full max-w-sm">
      <CardBody className="flex flex-col gap-5">
        <div className="text-center">
          <p className="text-lg font-bold text-[#F2D695]">{BRAND.name}</p>
          <h1 className="mt-1 text-base font-semibold text-slate-100">
            {step === 'phone' ? t.auth.phoneTitle : t.auth.codeTitle}
          </h1>
          {step === 'code' ? (
            <p className="mt-1 text-sm text-slate-400">
              {t.auth.codeSentTo} {phone}
            </p>
          ) : null}
        </div>

        {step === 'phone' ? (
          <form onSubmit={requestCode} className="flex flex-col gap-4">
            <Input
              name="phone"
              label={t.auth.phoneLabel}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder={t.auth.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {error ? <p className="text-sm text-[#F2B8B8]">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t.auth.sending : t.auth.sendCode}
            </Button>
          </form>
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
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Input
              name="name"
              label={t.auth.nameLabel}
              type="text"
              autoComplete="name"
              placeholder={t.auth.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {error ? <p className="text-sm text-[#F2B8B8]">{error}</p> : null}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t.auth.verifying : t.auth.verify}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
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
      </CardBody>
    </Card>
  );
}
