'use client';

import { useActionState, useEffect, useState } from 'react';
import type { SaveState } from '../settings/parse';
import { t } from '@/i18n';
import { Button } from '@/components/ui';
import BookingLinkShare from '@/components/booking/BookingLinkShare';
import { ImageUploadField, type ImageUploadLabels } from '../settings/ImageUploadField';
import { saveServices, saveHours, saveBranding } from './actions';

/** תת-קבוצה סריאליזבילית של שירות, לרינדור שורות ההחלפה בצעד השירותים. */
export type WizardService = {
  id: string;
  name: string;
  durationMin: number;
  priceAgorot: number;
  hidden: boolean;
};

type HoursPresetKey = 'sun-thu' | 'every-day' | 'custom';

type Props = {
  businessName: string;
  brandColor: string;
  logoUrl: string;
  services: WizardService[];
  bookingUrl: string;
  bookingQr: string;
};

const initialSaveState: SaveState = { ok: false };

/** ששת גווני המותג המוצעים (תואם למוקאפ המאושר). */
const BRAND_SWATCHES = ['#0a182d', '#12b886', '#7c3aed', '#e11d48', '#f59e0b', '#0ea5e9'];

function errorText(state: SaveState): string | null {
  if (!state.error) return null;
  if (state.error === 'no_business') return t.admin.onboarding.errorNoBusiness;
  return t.admin.onboarding.errorGeneric;
}

/** ₪ → אגורות (מספר שלם), עם הגנה מפני קלט לא-מספרי. */
function shekelToAgorot(raw: string): number {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

export default function OnboardingWizard({
  businessName,
  brandColor,
  logoUrl,
  services,
  bookingUrl,
  bookingQr,
}: Props) {
  const o = t.admin.onboarding;
  const [step, setStep] = useState(0); // 0=services 1=hours 2=branding
  const [done, setDone] = useState(false);

  // מצב מקומי לצעד השירותים: אילו שירותים פעילים + טופס "הוספת שירות משלך".
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(services.map((s) => [s.id, !s.hidden])),
  );
  const [addingService, setAddingService] = useState(false);

  // מצב מקומי לצעד המיתוג: צבע חי לתצוגה המקדימה + בחירת תבנית שעות.
  const [color, setColor] = useState(brandColor || '#0a182d');
  const [preset, setPreset] = useState<HoursPresetKey>('sun-thu');

  const [servicesState, servicesFormAction, servicesPending] = useActionState(
    saveServices,
    initialSaveState,
  );
  const [hoursState, hoursFormAction, hoursPending] = useActionState(saveHours, initialSaveState);
  const [brandingState, brandingFormAction, brandingPending] = useActionState(
    saveBranding,
    initialSaveState,
  );

  useEffect(() => {
    if (servicesState.ok) setStep(1);
  }, [servicesState]);
  useEffect(() => {
    if (hoursState.ok) setStep(2);
  }, [hoursState]);
  useEffect(() => {
    if (brandingState.ok) setDone(true);
  }, [brandingState]);

  const activeCount = Object.values(active).filter(Boolean).length;

  const imageLabels: ImageUploadLabels = {
    choose: t.admin.settings.profile.image.choose,
    change: t.admin.settings.profile.image.change,
    remove: t.admin.settings.profile.image.remove,
    cropTitle: t.admin.settings.profile.image.cropTitle,
    zoom: t.admin.settings.profile.image.zoom,
    adjust: t.admin.settings.profile.image.adjust,
    done: t.admin.settings.profile.image.done,
    cancel: t.admin.settings.profile.image.cancel,
    dragHint: t.admin.settings.profile.image.logoDragHint,
    empty: t.admin.settings.profile.image.logoEmpty,
    tooLarge: t.admin.settings.profile.image.tooLarge,
  };

  // ── מסך סיום "אתם באוויר" (טרמינלי) ──────────────────────────────
  if (done) {
    const su = o.success;
    const whatsappText = encodeURIComponent(
      `${o.goLive.share.shareText.replace('{name}', businessName)} ${bookingUrl}`,
    );
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
          <BookingLinkShare url={bookingUrl} qrSvg={bookingQr} businessName={businessName} />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            <span aria-hidden="true">💬</span>
            {o.goLive.share.nativeShare} · WhatsApp
          </a>
          <Button href="/admin" className="justify-center">
            {su.cta}
          </Button>
        </div>
      </section>
    );
  }

  const stepKeys = ['services', 'hours', 'branding'] as const;
  const stepKey = stepKeys[step];
  const progress = o.progress.replace('{current}', String(step + 1)).replace('{total}', '4');

  function backButton() {
    if (step === 0) return null;
    return (
      <button
        type="button"
        onClick={() => setStep((n) => Math.max(0, n - 1))}
        className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {o.back}
      </button>
    );
  }

  return (
    <div dir="rtl">
      <div className="mb-5">
        <p className="text-sm font-medium text-emerald-600">{o[stepKey].eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{o[stepKey].title}</h2>
        <p className="mt-1 text-sm text-slate-500">{o[stepKey].subtitle}</p>
        <p className="mt-2 text-xs font-medium text-slate-400">{progress}</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {/* ── צעד שירותים ─────────────────────────────── */}
        {step === 0 ? (
          <form action={servicesFormAction} className="space-y-4">
            <ul className="space-y-2.5">
              {services.map((s) => {
                const on = active[s.id] ?? false;
                const priceLabel =
                  s.priceAgorot > 0
                    ? `₪${(s.priceAgorot / 100).toLocaleString('he-IL')}`
                    : o.services.free;
                return (
                  <li key={s.id}>
                    <label
                      className={
                        'flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 transition-colors ' +
                        (on
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-slate-300')
                      }
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-800">
                          {s.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {s.durationMin} {o.services.minutesSuffix} · {priceLabel}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setActive((prev) => ({ ...prev, [s.id]: e.target.checked }))
                        }
                        className="h-5 w-5 shrink-0 accent-emerald-500"
                      />
                    </label>
                    {/* מצב ההחלפה נשלח לשרת כשדה מוסתר לכל שירות */}
                    <input type="hidden" name={`svc:${s.id}`} value={on ? 'on' : 'off'} />
                  </li>
                );
              })}
            </ul>

            {addingService ? (
              <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {o.services.newNameLabel}
                  </label>
                  <input
                    name="newName"
                    type="text"
                    placeholder={o.services.newNamePlaceholder}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      {o.services.newDurationLabel}
                    </label>
                    <input
                      name="newDuration"
                      type="number"
                      inputMode="numeric"
                      min={5}
                      step={5}
                      defaultValue={30}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      {o.services.newPriceLabel}
                    </label>
                    <input
                      name="newPrice"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={1}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingService(false)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  {o.services.cancelAdd}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingService(true)}
                className="w-full rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 transition hover:border-emerald-300 hover:text-emerald-600"
              >
                + {o.services.addOwn}
              </button>
            )}

            {activeCount === 0 && !addingService ? (
              <p className="text-sm text-amber-600">{o.services.emptyWarning}</p>
            ) : null}
            {errorText(servicesState) ? (
              <p className="text-sm text-red-600">{errorText(servicesState)}</p>
            ) : null}

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={servicesPending || (activeCount === 0 && !addingService)}
                className="rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {servicesPending
                  ? o.saving
                  : activeCount === 1
                    ? o.services.continueCtaSingle
                    : o.services.continueCta.replace('{n}', String(activeCount))}
              </button>
            </div>
          </form>
        ) : null}

        {/* ── צעד שעות פעילות ─────────────────────────── */}
        {step === 1 ? (
          <form action={hoursFormAction} className="space-y-4">
            <div className="space-y-2.5">
              {(Object.keys(o.hours.presets) as HoursPresetKey[]).map((key) => {
                const p = o.hours.presets[key];
                const on = preset === key;
                return (
                  <label
                    key={key}
                    className={
                      'flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ' +
                      (on
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-300')
                    }
                  >
                    <input
                      type="radio"
                      name="preset"
                      value={key}
                      checked={on}
                      onChange={() => setPreset(key)}
                      className="h-5 w-5 shrink-0 accent-emerald-500"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800">{p.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{p.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">{o.hours.tuneLater}</p>
            {errorText(hoursState) ? (
              <p className="text-sm text-red-600">{errorText(hoursState)}</p>
            ) : null}
            <div className="flex items-center justify-between pt-1">
              {backButton()}
              <button
                type="submit"
                disabled={hoursPending}
                className="rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {hoursPending ? o.saving : o.hours.continueCta}
              </button>
            </div>
          </form>
        ) : null}

        {/* ── צעד מיתוג + תצוגה חיה ────────────────────── */}
        {step === 2 ? (
          <form action={brandingFormAction} className="space-y-5">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                {o.branding.logoLabel}
              </span>
              <ImageUploadField
                name="logoUrl"
                defaultValue={logoUrl}
                targetAspect={1}
                rounded
                maxWidth={512}
                maxHeight={512}
                mime="image/png"
                labels={imageLabels}
              />
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                {o.branding.colorLabel}
              </span>
              <div className="flex flex-wrap gap-2.5">
                {BRAND_SWATCHES.map((swatch) => {
                  const on = color.toLowerCase() === swatch.toLowerCase();
                  return (
                    <button
                      key={swatch}
                      type="button"
                      aria-label={swatch}
                      aria-pressed={on}
                      onClick={() => setColor(swatch)}
                      style={{ backgroundColor: swatch }}
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
                    aria-label={o.branding.colorLabel}
                  />
                </label>
              </div>
              <input type="hidden" name="brandColor" value={color} />
            </div>

            {/* תצוגה חיה של עמוד ההזמנות — נצבעת מיד לפי הצבע שנבחר */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">{o.branding.previewTitle}</p>
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <div className="h-16" style={{ backgroundColor: color }} />
                <div className="-mt-8 px-4 pb-4">
                  <div className="flex items-end gap-3">
                    <span
                      className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white text-xl font-bold text-slate-700 shadow"
                      style={{ color }}
                    >
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        businessName.trim().charAt(0) || '★'
                      )}
                    </span>
                    <span className="pb-1 font-bold text-slate-800">{businessName}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <span>{o.branding.previewServiceSample}</span>
                    <span
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {o.branding.previewBook}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {errorText(brandingState) ? (
              <p className="text-sm text-red-600">{errorText(brandingState)}</p>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              {backButton()}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={brandingPending}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60"
                >
                  {o.branding.skip}
                </button>
                <button
                  type="submit"
                  disabled={brandingPending}
                  className="rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {brandingPending ? o.branding.finishing : o.branding.finishCta}
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
