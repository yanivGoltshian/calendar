'use client';

import { useActionState, useEffect, useState } from 'react';
import { t } from '@/i18n';
import { Button } from '@/components/ui';
import BookingLinkShare from '@/components/booking/BookingLinkShare';
import {
  landingDefaults,
  normalizeLandingContent,
  landingSectionEnabledByDefault,
  TOGGLEABLE_LANDING_SECTIONS,
} from '@/lib/publicPageStyle';
import { PublicPageFields, type PublicPageValues } from '../../settings/fields';
import type { SaveState } from '../../settings/parse';
import { publishLanding } from './actions';

type Props = {
  b: PublicPageValues;
  businessName: string;
  brandColor: string;
  shareUrl: string;
  shareQr: string;
};

const initialSaveState: SaveState = { ok: false };
const BRAND_SWATCHES = ['#0a182d', '#12b886', '#7c3aed', '#e11d48', '#f59e0b', '#0ea5e9'];

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200';
const labelClass = 'mb-1 block text-sm font-medium text-slate-700';

function errorText(state: SaveState): string | null {
  const l = t.admin.onboarding.landing;
  if (!state.error) return null;
  if (state.error === 'no_business') return l.errorNoBusiness;
  return l.errorGeneric;
}

/**
 * אשף עמוד הנחיתה המתקדם — טופס יחיד עם שלושה פאנלים (כותרת/מיתוג, בחירת מקטעים,
 * מילוי תוכן) המוצגים לפי השלב, כך שכל השדות נשלחים יחד בפעולת הפרסום. משתמש
 * ב-PublicPageFields (עם דגלי הסתרה) כדי לשתף את אותם עורכי תוכן של מסך ההגדרות.
 */
export default function LandingOnboardingWizard({
  b,
  businessName,
  brandColor,
  shareUrl,
  shareQr,
}: Props) {
  const l = t.admin.onboarding.landing;
  const s = t.admin.settings.pageStyle;
  const defaults = landingDefaults(b.type);
  const lc = normalizeLandingContent(b.landingContent);

  const [step, setStep] = useState(0); // 0=hero, 1=sections, 2=content
  const [done, setDone] = useState(false);

  const [color, setColor] = useState(brandColor || '#0a182d');
  const [eyebrow, setEyebrow] = useState(lc?.heroEyebrow ?? '');
  const [headline, setHeadline] = useState(lc?.heroHeadline ?? '');
  const [subtext, setSubtext] = useState(lc?.heroSubtext ?? '');

  const [state, formAction, pending] = useActionState(publishLanding, initialSaveState);

  useEffect(() => {
    if (state.ok) setDone(true);
  }, [state]);

  if (done) {
    const su = l.success;
    return (
      <section
        dir="rtl"
        className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-sm sm:p-8"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5l5 5L20 6" />
          </svg>
        </span>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">{su.title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          {su.subtitle.replace('{name}', businessName)}
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-start sm:p-5">
          <BookingLinkShare url={shareUrl} qrSvg={shareQr} businessName={businessName} />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            {su.viewCta}
          </a>
          <Button href="/admin" className="justify-center">
            {su.cta}
          </Button>
        </div>
      </section>
    );
  }

  const stepMeta = step === 0 ? l.hero : step === 1 ? l.sections : l.content;
  const progress = l.progress
    .replace('{current}', String(step + 1))
    .replace('{total}', '3');
  const err = errorText(state);

  return (
    <div dir="rtl">
      <div className="mb-5">
        <p className="text-sm font-medium text-emerald-600">{stepMeta.eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{stepMeta.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{stepMeta.subtitle}</p>
        <p className="mt-2 text-xs font-medium text-slate-400">{progress}</p>
      </div>

      <form
        action={formAction}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        {/* שדות מוסתרים הנשלחים עם כל הטופס */}
        <input type="hidden" name="type" value={b.type ?? ''} />
        <input type="hidden" name="brandColor" value={color} />

        {/* ── פאנל 0: כותרת ומיתוג ── */}
        <div hidden={step !== 0} className="space-y-5">
          <div>
            <span className={labelClass}>{l.hero.colorLabel}</span>
            <div className="flex flex-wrap items-center gap-2.5">
              {BRAND_SWATCHES.map((sw) => {
                const on = color.toLowerCase() === sw.toLowerCase();
                return (
                  <button
                    key={sw}
                    type="button"
                    aria-label={sw}
                    aria-pressed={on}
                    onClick={() => setColor(sw)}
                    style={{ backgroundColor: sw }}
                    className={
                      'h-10 w-10 rounded-full ring-offset-2 transition ' +
                      (on ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200 hover:ring-slate-400')
                    }
                  />
                );
              })}
              <label className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5">
                <span className="text-xs text-slate-500">HEX</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                  aria-label={l.hero.colorLabel}
                />
              </label>
            </div>
          </div>

          <div>
            <label className={labelClass}>{s.heroEyebrowLabel}</label>
            <input
              name="landingHeroEyebrow"
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              placeholder={s.heroEyebrowPlaceholder}
              maxLength={60}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{s.heroHeadlineLabel}</label>
            <input
              name="landingHeroHeadline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={defaults.heroHeadline}
              maxLength={140}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{s.heroSubtextLabel}</label>
            <textarea
              name="landingHeroSubtext"
              value={subtext}
              onChange={(e) => setSubtext(e.target.value)}
              placeholder={defaults.heroSubtext}
              rows={2}
              maxLength={400}
              className={inputClass}
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">{l.hero.previewTitle}</p>
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
              <div
                className="px-5 py-8 text-center text-white"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
              >
                {eyebrow.trim() !== '' ? (
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
                    {eyebrow}
                  </p>
                ) : null}
                <p className="mt-1 text-lg font-bold">{headline || defaults.heroHeadline}</p>
                <p className="mx-auto mt-1 max-w-xs text-xs opacity-90">
                  {subtext || defaults.heroSubtext}
                </p>
                <span
                  className="mt-3 inline-block rounded-lg bg-white px-4 py-1.5 text-xs font-semibold"
                  style={{ color }}
                >
                  {l.hero.previewBook}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── פאנל 1: בחירת מקטעים ── */}
        <div hidden={step !== 1} className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {TOGGLEABLE_LANDING_SECTIONS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300"
              >
                <input
                  type="checkbox"
                  name={`landingSection_${key}`}
                  defaultChecked={lc?.sections?.[key] ?? landingSectionEnabledByDefault(key, b.type)}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span className="text-sm font-medium text-slate-800">{s.sectionNames[key]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── פאנל 2: מילוי תוכן (שיתוף עורכי ההגדרות) ── */}
        <div hidden={step !== 2}>
          <PublicPageFields b={b} hideStyleChoice hideHero hideSections />
        </div>

        {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

        <div className="mt-6 flex items-center justify-between">
          {step === 0 ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={() => setStep((n) => Math.max(0, n - 1))}
              className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {l.back}
            </button>
          )}

          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((n) => Math.min(2, n + 1))}
              className="rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white transition hover:bg-slate-800"
            >
              {step === 0 ? l.hero.continueCta : l.sections.continueCta}
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {pending ? l.content.publishing : l.content.publishCta}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
