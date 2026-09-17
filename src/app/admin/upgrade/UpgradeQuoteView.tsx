import type { ReactNode } from 'react';
import { t } from '@/i18n';

type Variant = 'page' | 'paywall';

export default function UpgradeQuoteView({
  variant,
  stateLine,
  contactForm,
}: {
  variant: Variant;
  stateLine: string;
  contactForm: ReactNode;
}) {
  const dark = variant === 'paywall';

  return (
    <section dir="rtl" className="text-right">
      {!dark ? (
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#1c1512]">{t.quote.page.title}</h1>
          <p className="mt-2 text-[#6e655f]">{t.quote.page.subtitle}</p>
        </header>
      ) : (
        <h2 className="mb-2 text-xl font-extrabold text-[#1c1512]">
          {t.quote.form.heading}
        </h2>
      )}

      <p
        className={
          dark
            ? 'mb-5 rounded-lg bg-[#FBF7EC] px-4 py-2 text-sm text-[#6B5426]'
            : 'mb-6 rounded-lg border border-[#E7D9B8] bg-[#FBF7EC] px-4 py-2 text-sm text-[#6B5426]'
        }
      >
        {stateLine}
      </p>

      {!dark ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {(['standard', 'premium', 'exclusive'] as const).map((key) => {
            const plan = (
              t.quote.plans as unknown as Record<
                string,
                { name: string; tagline: string; features: string[] }
              >
            )[key];
            if (!plan) return null;
            return (
              <div
                key={key}
                className="rounded-2xl border border-[#e7ddcd] bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-[#1c1512]">{plan.name}</h3>
                  <span className="rounded-full bg-[#1c1512] px-3 py-1 text-xs font-semibold text-[#F2D695]">
                    {t.quote.plans.contactTag}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#6e655f]">{plan.tagline}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-[#4a4038]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="text-[#C59D5F]">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mb-4">
        <p className="text-sm text-[#6e655f]">{t.quote.form.intro}</p>
      </div>

      {contactForm}
    </section>
  );
}
