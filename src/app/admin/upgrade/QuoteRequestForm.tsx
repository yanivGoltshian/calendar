'use client';

import { useActionState } from 'react';
import { t } from '@/i18n';
import { submitQuoteRequest, type QuoteRequestState } from './actions';

export type QuoteFormDefaults = {
  plan: 'STANDARD' | 'PREMIUM' | 'EXCLUSIVE';
  name: string;
  email: string;
  phone: string;
  publicPageUrl: string;
};

const initialState: QuoteRequestState = { ok: false };

const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] bg-white px-3 py-2 text-[#1b1715] outline-none focus:border-[#C59D5F] focus:ring-1 focus:ring-[#C59D5F]';

/**
 * טופס בקשת הצעת מחיר (D4). מוזן מראש מפרטי העסק המחובר, וניתן לעריכה לפני שליחה.
 * בהצלחה מוצג מצב אישור. לעולם אינו חושף מחיר מספרי.
 */
export default function QuoteRequestForm({ defaults }: { defaults: QuoteFormDefaults }) {
  const [state, formAction, pending] = useActionState(submitQuoteRequest, initialState);
  const f = t.quote.form;
  const plansCopy = t.quote.plans as unknown as Record<
    string,
    { name: string; tagline: string; features?: string[] }
  >;

  const errorText =
    state.error === 'auth'
      ? t.quote.errors.auth
      : state.error === 'plan'
        ? t.quote.errors.plan
        : state.error === 'name'
          ? t.quote.errors.name
          : state.error === 'email'
            ? t.quote.errors.email
            : state.error === 'phone'
              ? t.quote.errors.phone
              : state.error
                ? t.quote.errors.generic
                : null;

  if (state.ok) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-[#E7D9B8] bg-[#FBF7EC] p-6 text-center"
      >
        <h3 className="text-lg font-extrabold text-[#1c1512]">{t.quote.success.title}</h3>
        <p className="mt-2 text-[#4a4038]">{t.quote.success.body}</p>
      </div>
    );
  }

  return (
    <form action={formAction} dir="rtl" className="space-y-5">
      <div>
        <span className="mb-2 block text-sm font-semibold text-[#2a2320]">
          {f.planLabel}
        </span>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['STANDARD', 'PREMIUM', 'EXCLUSIVE'] as const).map((code) => {
            const plan = plansCopy[code.toLowerCase()];
            if (!plan) return null;
            return (
              <label
                key={code}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d6c8b4] bg-white p-4 transition has-[:checked]:border-[#C59D5F] has-[:checked]:bg-[#FBF7EC] has-[:checked]:ring-1 has-[:checked]:ring-[#C59D5F]"
              >
                <input
                  type="radio"
                  name="plan"
                  value={code}
                  defaultChecked={defaults.plan === code}
                  className="mt-1 accent-[#C59D5F]"
                />
                <span>
                  <span className="block font-bold text-[#1c1512]">{plan.name}</span>
                  <span className="mt-0.5 block text-sm text-[#6e655f]">{plan.tagline}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[#4a4038]">
          {f.publicPageLabel}
        </label>
        <div className="truncate rounded-lg border border-[#e7ddcd] bg-[#f7f2ea] px-3 py-2 text-sm text-[#6e655f]">
          {defaults.publicPageUrl}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {f.nameLabel}
          </label>
          <input name="name" required defaultValue={defaults.name} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">
            {f.phoneLabel}
          </label>
          <input
            name="phone"
            required
            inputMode="tel"
            defaultValue={defaults.phone}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[#4a4038]">
          {f.emailLabel}
        </label>
        <input
          name="email"
          type="email"
          required
          defaultValue={defaults.email}
          className={inputClass}
        />
      </div>

      {errorText ? (
        <p className="text-sm font-medium text-red-600">{errorText}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#1c1512] px-5 py-3 font-bold text-[#F2D695] transition hover:bg-[#241a15] disabled:opacity-60 sm:w-auto"
      >
        {pending ? f.submitting : f.submit}
      </button>
    </form>
  );
}
