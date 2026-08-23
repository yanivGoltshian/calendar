'use client';

import { useActionState, useState } from 'react';
import { t } from '@/i18n';
import {
  submitQuoteRequest,
  type QuoteRequestState,
} from '@/app/admin/upgrade/actions';
import { buildWhatsappQuoteLink } from '@/lib/whatsappQuote';
import CustomerGoogleSignIn from '@/components/auth/CustomerGoogleSignIn';

export type PublicQuoteDefaults = {
  mode: 'owner' | 'visitor';
  plan: 'STANDARD' | 'PREMIUM' | 'EXCLUSIVE';
  name: string;
  email: string;
  phone: string;
  businessName: string;
  publicPageUrl: string;
};

const initialState: QuoteRequestState = { ok: false };

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-[#C59D5F] focus:ring-1 focus:ring-[#C59D5F]';

/**
 * טופס הצעת המחיר הציבורי. מסירה ראשית: קישור wa.me הנבנה בזמן אמת מערכי הטופס
 * ונפתח בלשונית חדשה (בלי תשתית שרת). לבעל עסק מחובר מתבצעת גם שמירה מיטבית
 * של PlanInquiry דרך שרת-האקשן הקיים, כדי שהליד יופיע גם בקונסולת ניהול-העל.
 * כשל בשמירה לעולם אינו חוסם את קישור הוואטסאפ.
 */
export default function PublicQuoteForm({
  defaults,
  authed = false,
  googleEnabled = false,
}: {
  defaults: PublicQuoteDefaults;
  // מבקר מחובר (בעלים או לקוח): מסתיר את כפתור כניסת הגוגל.
  authed?: boolean;
  // כניסת גוגל זמינה בסביבה (GOOGLE_CLIENT_ID/SECRET מוגדרים).
  googleEnabled?: boolean;
}) {
  const isOwner = defaults.mode === 'owner';
  const f = t.quote.form;
  const w = t.quote.whatsapp;
  const showGoogle = !authed && googleEnabled;

  // עותק החבילות מגיע מבלוק השיווק (t.quote.plans). קריאה גמישה לפי קוד החבילה
  // כדי ש-exclusive יוצג ברגע שהעותק קיים, בלי לשבור טיפוסים אם עדיין חסר.
  const plansCopy = t.quote.plans as unknown as Record<
    string,
    { name: string; tagline: string; features?: string[] }
  >;

  const [plan, setPlan] = useState<'STANDARD' | 'PREMIUM' | 'EXCLUSIVE'>(
    defaults.plan,
  );
  const [name, setName] = useState(defaults.name);
  const [phone, setPhone] = useState(defaults.phone);
  const [email, setEmail] = useState(defaults.email);
  const [businessName, setBusinessName] = useState(defaults.businessName);

  const [state, formAction, pending] = useActionState(
    submitQuoteRequest,
    initialState,
  );

  const planLabel = plansCopy[plan.toLowerCase()]?.name ?? plansCopy.standard.name;

  const waLink = buildWhatsappQuoteLink({
    businessName: isOwner ? defaults.businessName : businessName,
    planLabel,
    ownerName: name,
    phone,
    email,
    publicPageUrl: defaults.publicPageUrl || null,
  });

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

  const savedCard =
    isOwner && state.ok ? (
      <div className="rounded-2xl border border-[#E7D9B8] bg-[#FBF7EC] p-6 text-center">
        <h3 className="text-lg font-extrabold text-[#0A182D]">
          {t.quote.success.title}
        </h3>
        <p className="mt-2 text-slate-700">{t.quote.success.body}</p>
      </div>
    ) : null;

  return (
    <div dir="rtl" className="space-y-6">
      {/* כניסת לקוח חוזר עם גוגל — מוצגת רק כשהמבקר אינו מחובר, מפנה דרך גשר הזהות */}
      {showGoogle ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="mb-3 text-sm text-slate-600">{t.account.googlePrompt}</p>
          <CustomerGoogleSignIn callbackUrl={`/account/continue?next=${encodeURIComponent('/quote')}`} />
        </div>
      ) : null}
      <form
        action={isOwner ? formAction : undefined}
        onSubmit={isOwner ? undefined : (e) => e.preventDefault()}
        className="space-y-5"
      >
        <div>
          <span className="mb-2 block text-sm font-semibold text-slate-800">
            {f.planLabel}
          </span>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['STANDARD', 'PREMIUM', 'EXCLUSIVE'] as const).map((code) => {
              const p = plansCopy[code.toLowerCase()];
              if (!p) return null;
              return (
                <label
                  key={code}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-white p-4 transition has-[:checked]:border-[#C59D5F] has-[:checked]:bg-[#FBF7EC] has-[:checked]:ring-1 has-[:checked]:ring-[#C59D5F]"
                >
                  <input
                    type="radio"
                    name="plan"
                    value={code}
                    checked={plan === code}
                    onChange={() => setPlan(code)}
                    className="mt-1 accent-[#C59D5F]"
                  />
                  <span>
                    <span className="block font-bold text-[#0A182D]">{p.name}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">
                      {p.tagline}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {isOwner ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {f.publicPageLabel}
            </label>
            <div className="truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {defaults.publicPageUrl}
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {f.businessNameLabel}
            </label>
            <input
              name="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={f.businessNamePlaceholder}
              className={inputClass}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {f.nameLabel}
            </label>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {f.phoneLabel}
            </label>
            <input
              name="phone"
              required
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {f.emailLabel}
          </label>
          <input
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* מסירה ראשית: וואטסאפ. קישור חי הנבנה מערכי הטופס, נפתח בלשונית חדשה. */}
        <div className="space-y-2">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={w.aria}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-lg font-extrabold text-white shadow-sm transition hover:bg-[#1EBE5B]"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-6 w-6 fill-current"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.887 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .103 5.359.1 11.943c0 2.096.547 4.142 1.588 5.945L0 24l6.304-1.654a11.881 11.881 0 005.71 1.454h.005c6.581 0 11.940-5.36 11.943-11.945A11.86 11.86 0 0020.52 3.449" />
            </svg>
            {w.cta}
          </a>
          <p className="text-center text-xs text-slate-500">{w.hint}</p>
        </div>

        {errorText ? (
          <p className="text-sm font-medium text-red-600">{errorText}</p>
        ) : null}

        {isOwner ? (
          <button
            type="submit"
            disabled={pending}
            className="min-h-[44px] w-full rounded-xl border border-[#0A182D] bg-white px-5 py-3 font-bold text-[#0A182D] transition hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
          >
            {pending ? f.submitting : f.submit}
          </button>
        ) : null}
      </form>

      {savedCard}
    </div>
  );
}
