'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { SaveState } from '../settings/parse';
import { t } from '@/i18n';
import { Button } from '@/components/ui';
import BookingLinkShare from '@/components/booking/BookingLinkShare';
import { ImageUploadField, type ImageUploadLabels } from '../settings/ImageUploadField';
import { saveServices, saveHours, saveBranding, savePremiumLanding } from './actions';
import { buildDefaultSectionToggles } from './premium';
import {
  TOGGLEABLE_LANDING_SECTIONS,
  type LandingContent,
  type LandingBenefit,
  type LandingTestimonial,
  type LandingFaqItem,
  type LandingBeforeAfter,
  type LandingSocialLinks,
  type LandingSectionKey,
} from '@/lib/publicPageStyle';

/** תת-קבוצה סריאליזבילית של שירות, לרינדור שורות ההחלפה בצעד השירותים. */
export type WizardService = {
  id: string;
  name: string;
  durationMin: number;
  priceAgorot: number;
  hidden: boolean;
};

type HoursPresetKey = 'sun-thu' | 'every-day' | 'custom';

/**
 * שלב הפרימיום האופציונלי (אחרי המיתוג):
 * 'gate' שער הבחירה, מספר 0..8 תת-שלב פעיל, 'summary' מסך הסיכום.
 */
type PremiumPhase = 'gate' | number | 'summary';

/** מפתחות תתי-השלבים של הפרימיום, לפי סדר ההצגה (0..8). */
const PREMIUM_SUB_KEYS = [
  'hero',
  'about',
  'benefits',
  'gallery',
  'beforeAfter',
  'testimonials',
  'faq',
  'social',
  'closing',
] as const;

type Props = {
  businessName: string;
  brandColor: string;
  logoUrl: string;
  services: WizardService[];
  serviceExample: string;
  bookingUrl: string;
  bookingQr: string;
  // ── פרימיום: פרטי העסק והתוכן ההתחלתי לעמוד הנחיתה ──
  businessType: string;
  businessAddress: string;
  slug: string;
  premiumInitial: LandingContent | null;
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
  serviceExample,
  bookingUrl,
  bookingQr,
  businessType,
  businessAddress,
  slug,
  premiumInitial,
}: Props) {
  const o = t.admin.onboarding;
  const [step, setStep] = useState(0); // 0=services 1=hours 2=branding
  const [done, setDone] = useState(false);

  // ── מצב שלב הפרימיום (אופציונלי, מופעל אחרי המיתוג) ──
  // premiumPhase=null ⇐ שלב הפרימיום עדיין מחוץ לתמונה (שלושת הצעדים הרגילים).
  const [premiumPhase, setPremiumPhase] = useState<PremiumPhase | null>(null);
  // טיוטת התוכן היא מקור האמת היחיד; נשלחת כשדה JSON יחיד בכל שמירה.
  const [premiumDraft, setPremiumDraft] = useState<LandingContent>(() => premiumInitial ?? {});
  // יעד המעבר אחרי שמירה מוצלחת, נקבע ב-onClick לפני שליחת הטופס.
  const nextTargetRef = useRef<PremiumPhase | 'done'>('gate');

  // מצב מקומי לצעד השירותים: אילו שירותים פעילים + טופס "הוספת שירות משלך".
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(services.map((s) => [s.id, !s.hidden])),
  );
  const [addingService, setAddingService] = useState(false);

  // טיוטת שירות חדש + רשימת השירותים שהבעלים כבר הוסיף (אפשר להוסיף כמה).
  const [draftName, setDraftName] = useState('');
  const [draftDuration, setDraftDuration] = useState('30');
  const [draftPrice, setDraftPrice] = useState('');
  const [newServices, setNewServices] = useState<
    { name: string; durationMin: number; priceAgorot: number }[]
  >([]);

  // מצב מקומי לצעד המיתוג: צבע חי לתצוגה המקדימה + בחירת תבנית שעות.
  const [color, setColor] = useState(brandColor || '#0a182d');
  const [preset, setPreset] = useState<HoursPresetKey>('sun-thu');
  // בחירת ימים ושעות ידנית, מוצגת כשנבחר "מותאם אישית" (ראשון–חמישי פתוחים כברירת מחדל).
  const [customDays, setCustomDays] = useState(() =>
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      open: weekday <= 4,
      start: '09:00',
      end: '17:00',
    })),
  );

  const [servicesState, servicesFormAction, servicesPending] = useActionState(
    saveServices,
    initialSaveState,
  );
  const [hoursState, hoursFormAction, hoursPending] = useActionState(saveHours, initialSaveState);
  const [brandingState, brandingFormAction, brandingPending] = useActionState(
    saveBranding,
    initialSaveState,
  );
  const [premiumState, premiumFormAction, premiumPending] = useActionState(
    savePremiumLanding,
    initialSaveState,
  );

  useEffect(() => {
    if (servicesState.ok) setStep(1);
  }, [servicesState]);
  useEffect(() => {
    if (hoursState.ok) setStep(2);
  }, [hoursState]);
  // אחרי המיתוג: במקום סיום מיידי, מציגים את שער הפרימיום האופציונלי.
  useEffect(() => {
    if (brandingState.ok) setPremiumPhase('gate');
  }, [brandingState]);
  // אחרי שמירת פרימיום מוצלחת: מעבר ליעד שנקבע (תת-שלב הבא / סיכום / סיום).
  useEffect(() => {
    if (!premiumState.ok) return;
    const target = nextTargetRef.current;
    if (target === 'done') setDone(true);
    else setPremiumPhase(target);
  }, [premiumState]);

  const activeCount = Object.values(active).filter(Boolean).length;
  const draftPending = draftName.trim() !== '' ? 1 : 0;
  const totalSelected = activeCount + newServices.length + draftPending;

  function addDraftService() {
    const name = draftName.trim();
    if (name === '') return;
    const parsedDuration = Number.parseInt(draftDuration, 10);
    setNewServices((prev) => [
      ...prev,
      {
        name,
        durationMin: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30,
        priceAgorot: shekelToAgorot(draftPrice),
      },
    ]);
    setDraftName('');
    setDraftDuration('30');
    setDraftPrice('');
  }

  function removeNewService(idx: number) {
    setNewServices((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCustomDay(
    weekday: number,
    patch: Partial<{ open: boolean; start: string; end: string }>,
  ) {
    setCustomDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

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

  // ── שלב הפרימיום האופציונלי: מוצג אחרי המיתוג ולפני שובו של האשף הרגיל ──
  // (premiumPhase!==null בלבד; שלושת הצעדים הרגילים אינם מושפעים.)
  if (premiumPhase !== null) return renderPremium();

  /**
   * רינדור שער הפרימיום, תשעת תתי-השלבים הדילוגיים, ומסך הסיכום.
   * הפונקציה מוגדרת כ-declaration ולכן זמינה בעת הקריאה בשמירה למעלה.
   */
  function renderPremium() {
    const p = o.premium;
    const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm';
    const labelCls = 'mb-1 block text-sm font-medium text-slate-700';
    const cardCls = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6';
    const err = errorText(premiumState);

    // עדכון נקודתי של הטיוטה (מקור האמת היחיד לתוכן הפרימיום).
    const patchDraft = (patch: Partial<LandingContent>) =>
      setPremiumDraft((prev) => ({ ...prev, ...patch }));

    // שדה טקסט/מרובה-שורות מבוקר, ללא name (נשמר לטיוטה, לא נכנס לשליחת הטופס).
    const textField = (opts: {
      id: string;
      label: string;
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
      textarea?: boolean;
      rows?: number;
      dir?: 'rtl' | 'ltr';
      type?: string;
    }) => (
      <div>
        <label htmlFor={opts.id} className={labelCls}>
          {opts.label}
        </label>
        {opts.textarea ? (
          <textarea
            id={opts.id}
            value={opts.value}
            rows={opts.rows ?? 3}
            onChange={(e) => opts.onChange(e.target.value)}
            placeholder={opts.placeholder}
            dir={opts.dir}
            className={inputCls}
          />
        ) : (
          <input
            id={opts.id}
            type={opts.type ?? 'text'}
            value={opts.value}
            onChange={(e) => opts.onChange(e.target.value)}
            placeholder={opts.placeholder}
            dir={opts.dir}
            className={inputCls}
          />
        )}
      </div>
    );

    // ── שער הבחירה: שאלה מפורשת עם המשך/דילוג ──
    if (premiumPhase === 'gate') {
      const g = p.gate;
      return (
        <div dir="rtl">
          <section className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-sm sm:p-8">
            <span
              aria-hidden="true"
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl shadow-lg"
            >
              ✨
            </span>
            <p className="mt-4 text-sm font-medium text-emerald-600">{g.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{g.title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{g.subtitle}</p>
            <div className="mt-6 flex flex-col items-center gap-3">
              {/* המשך: שומר טיוטה ריקה ומעביר לתת-השלב הראשון */}
              <form action={premiumFormAction} className="w-full sm:w-auto">
                <input type="hidden" name="premiumDraft" value={JSON.stringify(premiumDraft)} />
                <button
                  type="submit"
                  disabled={premiumPending}
                  onClick={() => {
                    nextTargetRef.current = 0;
                  }}
                  className="w-full rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                >
                  {premiumPending ? p.nav.saving : g.build}
                </button>
              </form>
              {/* דילוג: סיום מיידי אל מסך שיתוף קישור ההזמנות */}
              <button
                type="button"
                onClick={() => setDone(true)}
                className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
              >
                {g.skip}
              </button>
            </div>
            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
          </section>
        </div>
      );
    }

    // ── מסך הסיכום: תצוגה מקדימה + סיום ──
    if (premiumPhase === 'summary') {
      const s = p.summary;
      return (
        <div dir="rtl">
          <section className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-sm sm:p-8">
            <span
              aria-hidden="true"
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl shadow-lg"
            >
              ✨
            </span>
            <p className="mt-4 text-sm font-medium text-emerald-600">{s.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{s.title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {s.subtitle.replace('{name}', businessName)}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <a
                href={`/b/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-xl border border-slate-300 px-6 py-2.5 text-center font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                {s.previewCta}
              </a>
              <form action={premiumFormAction} className="w-full sm:w-auto">
                <input type="hidden" name="premiumDraft" value={JSON.stringify(premiumDraft)} />
                <button
                  type="submit"
                  disabled={premiumPending}
                  onClick={() => {
                    nextTargetRef.current = 'done';
                  }}
                  className="w-full rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                >
                  {premiumPending ? p.nav.saving : s.finishCta}
                </button>
              </form>
            </div>
            <p className="mt-4 text-xs text-slate-400">{s.editHint}</p>
            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
          </section>
        </div>
      );
    }

    // מכאן ואילך: תת-שלב ממוספר בלבד (0..8). שמירת טיפוסים מפני null.
    if (typeof premiumPhase !== 'number') return null;
    const sub = premiumPhase;
    const subKey = PREMIUM_SUB_KEYS[sub];
    const sk = p.steps[subKey];
    const isLast = sub === PREMIUM_SUB_KEYS.length - 1;
    const progress = p.nav.progress
      .replace('{current}', String(sub + 1))
      .replace('{total}', String(PREMIUM_SUB_KEYS.length));

    // אוספים נגזרים לרינדור (תמונת-מצב לקריאה בלבד).
    const benefits = premiumDraft.benefits ?? [];
    const testimonials = premiumDraft.testimonials ?? [];
    const faq = premiumDraft.faq ?? [];
    const beforeAfter = premiumDraft.beforeAfter ?? [];
    const galleryUrls = premiumDraft.galleryImageUrls ?? [];
    const social: LandingSocialLinks = premiumDraft.socialLinks ?? {};
    const sections = premiumDraft.sections ?? buildDefaultSectionToggles(businessType);

    // ── עוזרי עריכה של אוספים (פונקציונליים, בטוחים לעדכונים עוקבים) ──
    const updateBenefit = (i: number, patch: Partial<LandingBenefit>) =>
      setPremiumDraft((prev) => ({
        ...prev,
        benefits: (prev.benefits ?? []).map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
      }));
    const addBenefit = () =>
      setPremiumDraft((prev) => ({
        ...prev,
        benefits: [...(prev.benefits ?? []), { title: '', text: '' }],
      }));
    const removeBenefit = (i: number) =>
      setPremiumDraft((prev) => ({
        ...prev,
        benefits: (prev.benefits ?? []).filter((_, idx) => idx !== i),
      }));

    const updateTestimonial = (i: number, patch: Partial<LandingTestimonial>) =>
      setPremiumDraft((prev) => ({
        ...prev,
        testimonials: (prev.testimonials ?? []).map((x, idx) =>
          idx === i ? { ...x, ...patch } : x,
        ),
      }));
    const addTestimonial = () =>
      setPremiumDraft((prev) => ({
        ...prev,
        testimonials: [...(prev.testimonials ?? []), { name: '', quote: '' }],
      }));
    const removeTestimonial = (i: number) =>
      setPremiumDraft((prev) => ({
        ...prev,
        testimonials: (prev.testimonials ?? []).filter((_, idx) => idx !== i),
      }));

    const updateFaq = (i: number, patch: Partial<LandingFaqItem>) =>
      setPremiumDraft((prev) => ({
        ...prev,
        faq: (prev.faq ?? []).map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
      }));
    const addFaq = () =>
      setPremiumDraft((prev) => ({
        ...prev,
        faq: [...(prev.faq ?? []), { question: '', answer: '' }],
      }));
    const removeFaq = (i: number) =>
      setPremiumDraft((prev) => ({
        ...prev,
        faq: (prev.faq ?? []).filter((_, idx) => idx !== i),
      }));

    const updateBeforeAfter = (i: number, patch: Partial<LandingBeforeAfter>) =>
      setPremiumDraft((prev) => ({
        ...prev,
        beforeAfter: (prev.beforeAfter ?? []).map((x, idx) =>
          idx === i ? { ...x, ...patch } : x,
        ),
      }));
    const addBeforeAfter = () =>
      setPremiumDraft((prev) => ({
        ...prev,
        beforeAfter: [...(prev.beforeAfter ?? []), { beforeUrl: '', afterUrl: '', label: '' }],
      }));
    const removeBeforeAfter = (i: number) =>
      setPremiumDraft((prev) => ({
        ...prev,
        beforeAfter: (prev.beforeAfter ?? []).filter((_, idx) => idx !== i),
      }));

    const setGalleryUrl = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const next = [...(prev.galleryImageUrls ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, galleryImageUrls: next };
      });

    const setSocial = (key: keyof LandingSocialLinks, v: string) =>
      setPremiumDraft((prev) => ({
        ...prev,
        socialLinks: { ...(prev.socialLinks ?? {}), [key]: v },
      }));

    const setSection = (key: LandingSectionKey, on: boolean) =>
      setPremiumDraft((prev) => ({
        ...prev,
        sections: {
          ...(prev.sections ?? buildDefaultSectionToggles(businessType)),
          [key]: on,
        },
      }));

    // לכידת כתובות התמונות מ-ImageUploadField דרך אירוע input שמבעבע לטופס.
    const handlePremiumInput = (e: React.FormEvent<HTMLFormElement>) => {
      const el = e.target as HTMLInputElement;
      const name = el.name || '';
      if (!name.startsWith('premImg:')) return;
      const parts = name.split(':');
      if (parts[1] === 'gallery') {
        setGalleryUrl(Number(parts[2]), el.value);
      } else if (parts[1] === 'ba') {
        updateBeforeAfter(
          Number(parts[2]),
          parts[3] === 'before' ? { beforeUrl: el.value } : { afterUrl: el.value },
        );
      }
    };

    return (
      <div dir="rtl">
        <div className="mb-5">
          <p className="text-sm font-medium text-emerald-600">{sk.eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{sk.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{sk.subtitle}</p>
          <p className="mt-2 text-xs font-medium text-slate-400">{progress}</p>
        </div>

        <form action={premiumFormAction} onInput={handlePremiumInput} className={cardCls}>
          <div className="space-y-4">
            {/* ── (0) כותרת הירו ── */}
            {subKey === 'hero' && (
              <>
                {textField({
                  id: 'prem-hero-eyebrow',
                  label: p.steps.hero.eyebrowLabel,
                  value: premiumDraft.heroEyebrow ?? '',
                  placeholder: p.steps.hero.eyebrowPlaceholder,
                  onChange: (v) => patchDraft({ heroEyebrow: v }),
                })}
                {textField({
                  id: 'prem-hero-headline',
                  label: p.steps.hero.headlineLabel,
                  value: premiumDraft.heroHeadline ?? '',
                  placeholder: p.steps.hero.headlinePlaceholder,
                  onChange: (v) => patchDraft({ heroHeadline: v }),
                })}
                {textField({
                  id: 'prem-hero-subtext',
                  label: p.steps.hero.subtextLabel,
                  value: premiumDraft.heroSubtext ?? '',
                  placeholder: p.steps.hero.subtextPlaceholder,
                  onChange: (v) => patchDraft({ heroSubtext: v }),
                  textarea: true,
                  rows: 2,
                })}
              </>
            )}

            {/* ── (1) אודות ── */}
            {subKey === 'about' &&
              textField({
                id: 'prem-about',
                label: p.steps.about.label,
                value: premiumDraft.about ?? '',
                placeholder: p.steps.about.placeholder,
                onChange: (v) => patchDraft({ about: v }),
                textarea: true,
                rows: 5,
              })}

            {/* ── (2) יתרונות ── */}
            {subKey === 'benefits' && (
              <>
                {benefits.map((b, i) => (
                  <div key={i} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    {textField({
                      id: `prem-benefit-title-${i}`,
                      label: p.steps.benefits.titleLabel,
                      value: b.title,
                      placeholder: p.steps.benefits.titlePlaceholder,
                      onChange: (v) => updateBenefit(i, { title: v }),
                    })}
                    {textField({
                      id: `prem-benefit-text-${i}`,
                      label: p.steps.benefits.textLabel,
                      value: b.text,
                      placeholder: p.steps.benefits.textPlaceholder,
                      onChange: (v) => updateBenefit(i, { text: v }),
                    })}
                    <button
                      type="button"
                      onClick={() => removeBenefit(i)}
                      className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
                    >
                      {p.steps.benefits.remove}
                    </button>
                  </div>
                ))}
                {benefits.length < 3 && (
                  <button
                    type="button"
                    onClick={addBenefit}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    + {p.steps.benefits.add}
                  </button>
                )}
              </>
            )}

            {/* ── (3) גלריה ── */}
            {subKey === 'gallery' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i}>
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        {p.steps.gallery.imageLabel.replace('{n}', String(i + 1))}
                      </span>
                      <ImageUploadField
                        name={`premImg:gallery:${i}`}
                        defaultValue={galleryUrls[i] ?? ''}
                        targetAspect={4 / 3}
                        rounded={false}
                        maxWidth={1280}
                        maxHeight={960}
                        mime="image/jpeg"
                        labels={imageLabels}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400">{p.steps.gallery.hint}</p>
              </>
            )}

            {/* ── (4) לפני ואחרי ── */}
            {subKey === 'beforeAfter' && (
              <>
                {beforeAfter.map((pair, i) => (
                  <div key={i} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="mb-1 block text-sm font-medium text-slate-700">
                          {p.steps.beforeAfter.before}
                        </span>
                        <ImageUploadField
                          name={`premImg:ba:${i}:before`}
                          defaultValue={pair.beforeUrl}
                          targetAspect={4 / 3}
                          rounded={false}
                          maxWidth={1280}
                          maxHeight={960}
                          mime="image/jpeg"
                          labels={imageLabels}
                        />
                      </div>
                      <div>
                        <span className="mb-1 block text-sm font-medium text-slate-700">
                          {p.steps.beforeAfter.after}
                        </span>
                        <ImageUploadField
                          name={`premImg:ba:${i}:after`}
                          defaultValue={pair.afterUrl}
                          targetAspect={4 / 3}
                          rounded={false}
                          maxWidth={1280}
                          maxHeight={960}
                          mime="image/jpeg"
                          labels={imageLabels}
                        />
                      </div>
                    </div>
                    {textField({
                      id: `prem-ba-label-${i}`,
                      label: p.steps.beforeAfter.labelLabel,
                      value: pair.label ?? '',
                      placeholder: p.steps.beforeAfter.labelPlaceholder,
                      onChange: (v) => updateBeforeAfter(i, { label: v }),
                    })}
                    <button
                      type="button"
                      onClick={() => removeBeforeAfter(i)}
                      className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
                    >
                      {p.steps.beforeAfter.removePair}
                    </button>
                  </div>
                ))}
                {beforeAfter.length < 3 && (
                  <button
                    type="button"
                    onClick={addBeforeAfter}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    + {p.steps.beforeAfter.addPair}
                  </button>
                )}
              </>
            )}

            {/* ── (5) המלצות ── */}
            {subKey === 'testimonials' && (
              <>
                {testimonials.map((x, i) => (
                  <div key={i} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    {textField({
                      id: `prem-testi-name-${i}`,
                      label: p.steps.testimonials.nameLabel,
                      value: x.name ?? '',
                      placeholder: p.steps.testimonials.namePlaceholder,
                      onChange: (v) => updateTestimonial(i, { name: v }),
                    })}
                    {textField({
                      id: `prem-testi-quote-${i}`,
                      label: p.steps.testimonials.quoteLabel,
                      value: x.quote,
                      placeholder: p.steps.testimonials.quotePlaceholder,
                      onChange: (v) => updateTestimonial(i, { quote: v }),
                      textarea: true,
                      rows: 2,
                    })}
                    <button
                      type="button"
                      onClick={() => removeTestimonial(i)}
                      className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
                    >
                      {p.steps.testimonials.remove}
                    </button>
                  </div>
                ))}
                {testimonials.length < 3 && (
                  <button
                    type="button"
                    onClick={addTestimonial}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    + {p.steps.testimonials.add}
                  </button>
                )}
              </>
            )}

            {/* ── (6) שאלות נפוצות ── */}
            {subKey === 'faq' && (
              <>
                {faq.map((x, i) => (
                  <div key={i} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                    {textField({
                      id: `prem-faq-q-${i}`,
                      label: p.steps.faq.questionLabel,
                      value: x.question,
                      placeholder: p.steps.faq.questionPlaceholder,
                      onChange: (v) => updateFaq(i, { question: v }),
                    })}
                    {textField({
                      id: `prem-faq-a-${i}`,
                      label: p.steps.faq.answerLabel,
                      value: x.answer,
                      placeholder: p.steps.faq.answerPlaceholder,
                      onChange: (v) => updateFaq(i, { answer: v }),
                      textarea: true,
                      rows: 2,
                    })}
                    <button
                      type="button"
                      onClick={() => removeFaq(i)}
                      className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
                    >
                      {p.steps.faq.remove}
                    </button>
                  </div>
                ))}
                {faq.length < 5 && (
                  <button
                    type="button"
                    onClick={addFaq}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    + {p.steps.faq.add}
                  </button>
                )}
              </>
            )}

            {/* ── (7) רשתות ומיקום ── */}
            {subKey === 'social' && (
              <>
                {(['whatsapp', 'instagram', 'facebook', 'tiktok'] as const).map((key) =>
                  textField({
                    id: `prem-social-${key}`,
                    label: p.steps.social[key],
                    value: social[key] ?? '',
                    placeholder: p.steps.social.urlPlaceholder,
                    onChange: (v) => setSocial(key, v),
                    type: 'url',
                    dir: 'ltr',
                  }),
                )}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">
                    {p.steps.social.locationTitle}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {businessAddress.trim() !== '' ? businessAddress : p.steps.social.noAddress}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">{p.steps.social.locationHint}</p>
                </div>
              </>
            )}

            {/* ── (8) כפתור סוגר + טוגלים של מקטעים ── */}
            {subKey === 'closing' && (
              <>
                {textField({
                  id: 'prem-cta-label',
                  label: p.steps.closing.ctaLabelLabel,
                  value: premiumDraft.ctaLabel ?? '',
                  placeholder: p.steps.closing.ctaLabelPlaceholder,
                  onChange: (v) => patchDraft({ ctaLabel: v }),
                })}
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {p.steps.closing.sectionsTitle}
                  </p>
                  <p className="mb-2 mt-1 text-xs text-slate-400">{p.steps.closing.sectionsHint}</p>
                  <div className="space-y-2">
                    {TOGGLEABLE_LANDING_SECTIONS.map((key) => {
                      const labels = p.steps.closing.sections as Record<string, string>;
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={sections[key] ?? false}
                            onChange={(e) => setSection(key, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          {labels[key]}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* שדה JSON יחיד שנושא את כל טיוטת התוכן אל פעולת השרת */}
            <input type="hidden" name="premiumDraft" value={JSON.stringify(premiumDraft)} />
            {err && <p className="text-sm text-rose-600">{err}</p>}

            {/* ── ניווט התחתית: חזרה / דילוג / שמירה ויציאה / המשך ── */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setPremiumPhase(sub === 0 ? 'gate' : sub - 1)}
                className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {p.nav.back}
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPremiumPhase(isLast ? 'summary' : sub + 1)}
                  disabled={premiumPending}
                  className="text-sm font-medium text-slate-500 transition hover:text-slate-700 disabled:opacity-60"
                >
                  {p.nav.skip}
                </button>
                <button
                  type="submit"
                  onClick={() => {
                    nextTargetRef.current = 'summary';
                  }}
                  disabled={premiumPending}
                  className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {p.nav.saveExit}
                </button>
                <button
                  type="submit"
                  onClick={() => {
                    nextTargetRef.current = isLast ? 'summary' : sub + 1;
                  }}
                  disabled={premiumPending}
                  className="rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {premiumPending ? p.nav.saving : p.nav.continue}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
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

            {newServices.length > 0 ? (
              <ul className="space-y-2">
                {newServices.map((svc, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{svc.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {svc.durationMin} {o.services.minutesSuffix} ·{' '}
                        {svc.priceAgorot > 0
                          ? `₪${(svc.priceAgorot / 100).toLocaleString('he-IL')}`
                          : o.services.free}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewService(idx)}
                      className="shrink-0 text-sm font-medium text-slate-500 hover:text-red-600"
                    >
                      {o.services.removeAdded}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {/* רשימת השירותים החדשים נשלחת לשרת כ-JSON */}
            <input type="hidden" name="newServices" value={JSON.stringify(newServices)} />

            {addingService ? (
              <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {o.services.newNameLabel}
                  </label>
                  <input
                    name="newName"
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={o.services.newNamePlaceholder.replace('{example}', serviceExample)}
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
                      value={draftDuration}
                      onChange={(e) => setDraftDuration(e.target.value)}
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
                      value={draftPrice}
                      onChange={(e) => setDraftPrice(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={addDraftService}
                    disabled={draftName.trim() === ''}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {o.services.addCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingService(false);
                      setDraftName('');
                      setDraftDuration('30');
                      setDraftPrice('');
                    }}
                    className="text-sm font-medium text-slate-500 hover:text-slate-700"
                  >
                    {o.services.cancelAdd}
                  </button>
                </div>
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

            {totalSelected === 0 && !addingService ? (
              <p className="text-sm text-amber-600">{o.services.emptyWarning}</p>
            ) : null}
            {errorText(servicesState) ? (
              <p className="text-sm text-red-600">{errorText(servicesState)}</p>
            ) : null}

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={servicesPending || totalSelected === 0}
                className="rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {servicesPending
                  ? o.saving
                  : totalSelected === 1
                    ? o.services.continueCtaSingle
                    : o.services.continueCta.replace('{n}', String(totalSelected))}
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

            {preset === 'custom' ? (
              <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">{o.hours.custom.title}</p>
                {customDays.map((day) => (
                  <div key={day.weekday} className="flex flex-wrap items-center gap-3">
                    <label className="flex min-w-[4.5rem] items-center gap-2">
                      <input
                        type="checkbox"
                        checked={day.open}
                        onChange={(e) => updateCustomDay(day.weekday, { open: e.target.checked })}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {o.hours.custom.days[day.weekday]}
                      </span>
                    </label>
                    {day.open ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={day.start}
                          onChange={(e) => updateCustomDay(day.weekday, { start: e.target.value })}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        />
                        <span className="text-slate-400">–</span>
                        <input
                          type="time"
                          value={day.end}
                          onChange={(e) => updateCustomDay(day.weekday, { end: e.target.value })}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">{o.hours.custom.closed}</span>
                    )}
                  </div>
                ))}
                <input type="hidden" name="customHours" value={JSON.stringify(customDays)} />
              </div>
            ) : null}

            <p className="rounded-2xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
              {o.hours.staffNote}
            </p>
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
