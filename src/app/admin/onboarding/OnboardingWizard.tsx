'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { SaveState } from '../settings/parse';
import { t } from '@/i18n';
import { Button } from '@/components/ui';
import BookingLinkShare from '@/components/booking/BookingLinkShare';
import { ImageUploadField, type ImageUploadLabels } from '../settings/ImageUploadField';
import { saveServices, saveHours, saveBranding, savePremiumLanding } from './actions';
import { buildDefaultSectionToggles, BRAND_PRESETS, type BrandPreset } from './premium';
import {
  type LandingContent,
  type LandingHotDeals,
  type LandingLaunchOffer,
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
 * 'gate' שער הבחירה, מספר 0..2 תת-שלב פעיל, 'summary' מסך הסיכום.
 */
type PremiumPhase = 'gate' | number | 'summary';

/**
 * שלושת תתי-השלבים של הפרימיום, כל אחד ממופה למקטע בעמוד הנחיתה הציבורי:
 * hero (הירו + תמונות), hotDeals (מבצעים חמים), location (מיקום + וואטסאפ).
 */
const PREMIUM_SUB_KEYS = ['hero', 'hotDeals', 'location'] as const;

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
/** גווני מותג ראשיים אצורים (פיקס) — קובעים brandColor בלבד; שאר גווני --biz-* נגזרים אוטומטית. */
const PRIMARY_SWATCHES = [
  '#1c1512', '#12b886', '#7c3aed', '#e11d48', '#f59e0b', '#0ea5e9',
  '#b0855f', '#d98ca3', '#3f9d8a', '#3b82c4', '#9b3b57', '#2fa9a2',
];

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
  const [color, setColor] = useState(brandColor || '#1c1512');
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

  // העלאת סרטון ראש-העמוד מהמכשיר (בנוסף לקישור יוטיוב/וימאו).
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const heroVideoInputRef = useRef<HTMLInputElement | null>(null);

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
        <h2 className="mt-4 text-2xl font-bold text-[#1b1715]">{su.title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#6e655f]">
          {su.subtitle.replace('{name}', businessName)}
        </p>

        <div className="mt-6 rounded-2xl border border-[#e7ddcd] bg-white p-4 text-start sm:p-5">
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
   * רינדור שער הפרימיום, שלושת תתי-השלבים הדילוגיים, ומסך הסיכום.
   * הפונקציה מוגדרת כ-declaration ולכן זמינה בעת הקריאה בשמירה למעלה.
   */
  function renderPremium() {
    const p = o.premium;
    const inputCls = 'w-full rounded-xl border border-[#d6c8b4] bg-white px-3 py-2.5 text-sm';
    const labelCls = 'mb-1 block text-sm font-medium text-[#4a4038]';
    const cardCls = 'rounded-3xl border border-[#e7ddcd] bg-white p-5 shadow-sm sm:p-6';
    const err = errorText(premiumState);

    // עדכון נקודתי של הטיוטה (מקור האמת היחיד לתוכן הפרימיום).
    const patchDraft = (patch: Partial<LandingContent>) =>
      setPremiumDraft((prev) => ({ ...prev, ...patch }));

    // העלאת קובץ וידאו מהמכשיר: אימות סוג/גודל בצד הלקוח, שליחה לנתיב המאובטח,
    // ובהצלחה שמירת כתובת ה-blob הציבורית כ-heroVideoUrl.
    const MAX_HERO_VIDEO_BYTES = 30 * 1024 * 1024;
    const handleHeroVideoFile = async (file: File | null | undefined) => {
      if (!file) return;
      setVideoUploadError(null);
      if (file.type !== 'video/mp4' && file.type !== 'video/webm') {
        setVideoUploadError(p.steps.hero.videoBadType);
        return;
      }
      if (file.size > MAX_HERO_VIDEO_BYTES) {
        setVideoUploadError(p.steps.hero.videoTooLarge);
        return;
      }
      setUploadingVideo(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload/hero-video', { method: 'POST', body: fd });
        const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!res.ok || !data?.url) {
          setVideoUploadError(data?.error ?? 'אירעה תקלה בהעלאה. אפשר לנסות שוב.');
          return;
        }
        patchDraft({ heroVideoUrl: data.url });
      } catch {
        setVideoUploadError('אירעה תקלה בהעלאה. אפשר לנסות שוב.');
      } finally {
        setUploadingVideo(false);
      }
    };

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

    // עדכון קישור רשת חברתית בטיוטה. מוגדר כאן כדי להיות זמין גם בשער וגם בתת-שלב המיקום.
    const setSocial = (key: keyof LandingSocialLinks, v: string) =>
      setPremiumDraft((prev) => ({
        ...prev,
        socialLinks: { ...(prev.socialLinks ?? {}), [key]: v },
      }));

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
            <h2 className="mt-1 text-2xl font-bold text-[#1b1715]">{g.title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6e655f]">{g.subtitle}</p>
            {/* רשתות חברתיות (אופציונלי): קישורים אלה מדליקים את כפתורי הרשתות ומחזקים את העמוד. */}
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#e7ddcd] bg-[#f7f2ea] p-4 text-right sm:p-5">
              <p className="text-sm font-semibold text-[#4a4038]">{g.social.title}</p>
              <p className="mt-1 text-xs text-[#6e655f]">{g.social.lead}</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="gate-social-ig" className={labelCls}>{g.social.instagramLabel}</label>
                  <input
                    id="gate-social-ig"
                    type="text"
                    dir="ltr"
                    value={premiumDraft.socialLinks?.instagram ?? ''}
                    onChange={(e) => setSocial('instagram', e.target.value)}
                    placeholder={g.social.instagramPlaceholder}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-[#b3a690]">{g.social.instagramHint}</p>
                </div>
                <div>
                  <label htmlFor="gate-social-tt" className={labelCls}>{g.social.tiktokLabel}</label>
                  <input
                    id="gate-social-tt"
                    type="text"
                    dir="ltr"
                    value={premiumDraft.socialLinks?.tiktok ?? ''}
                    onChange={(e) => setSocial('tiktok', e.target.value)}
                    placeholder={g.social.tiktokPlaceholder}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-[#b3a690]">{g.social.tiktokHint}</p>
                </div>
                <div>
                  <label htmlFor="gate-social-fb" className={labelCls}>{g.social.facebookLabel}</label>
                  <input
                    id="gate-social-fb"
                    type="text"
                    dir="ltr"
                    value={premiumDraft.socialLinks?.facebook ?? ''}
                    onChange={(e) => setSocial('facebook', e.target.value)}
                    placeholder={g.social.facebookPlaceholder}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-[#b3a690]">{g.social.facebookHint}</p>
                </div>
              </div>
            </div>
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
                  className="w-full rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60 sm:w-auto"
                >
                  {premiumPending ? p.nav.saving : g.build}
                </button>
              </form>
              {/* דילוג: סיום מיידי אל מסך שיתוף קישור ההזמנות */}
              <button
                type="button"
                onClick={() => setDone(true)}
                className="text-sm font-medium text-[#8f8478] transition hover:text-[#4a4038]"
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
            <h2 className="mt-1 text-2xl font-bold text-[#1b1715]">{s.title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6e655f]">
              {s.subtitle.replace('{name}', businessName)}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <a
                href={`/b/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-xl border border-[#d6c8b4] px-6 py-2.5 text-center font-semibold text-[#4a4038] transition hover:bg-[#f7f2ea] sm:w-auto"
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
                  className="w-full rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60 sm:w-auto"
                >
                  {premiumPending ? p.nav.saving : s.finishCta}
                </button>
              </form>
            </div>
            <p className="mt-4 text-xs text-[#b3a690]">{s.editHint}</p>
            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
          </section>
        </div>
      );
    }

    // מכאן ואילך: תת-שלב ממוספר בלבד (0..2). שמירת טיפוסים מפני null.
    if (typeof premiumPhase !== 'number') return null;
    const sub = premiumPhase;
    const subKey = PREMIUM_SUB_KEYS[sub];
    const sk = p.steps[subKey];
    const isLast = sub === PREMIUM_SUB_KEYS.length - 1;
    const progress = p.nav.progress
      .replace('{current}', String(sub + 1))
      .replace('{total}', String(PREMIUM_SUB_KEYS.length));

    // אוספים נגזרים לרינדור (תמונת-מצב לקריאה בלבד).
    const heroImages = premiumDraft.heroImages ?? [];
    const hotDeals: LandingHotDeals = premiumDraft.hotDeals ?? { images: [] };
    const hotDealsImages = hotDeals.images ?? [];
    const launchOffer: LandingLaunchOffer | undefined = premiumDraft.launchOffer;
    const social: LandingSocialLinks = premiumDraft.socialLinks ?? {};
    const instagramPosts = premiumDraft.instagramPostUrls ?? [];
    const socialVideos = premiumDraft.socialVideoUrls ?? [];
    const sections = premiumDraft.sections ?? buildDefaultSectionToggles(businessType);

    // ── עוזרי עריכה (פונקציונליים, בטוחים לעדכונים עוקבים) ──

    // הירו: עד שתי תמונות רקע (heroImages, נשמר כמערך כתובות).
    const setHeroImage = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const next = [...(prev.heroImages ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, heroImages: next };
      });

    // מבצעים חמים: שדות טקסט + עד שש תמונות טיפולים.
    const patchHotDeals = (patch: Partial<LandingHotDeals>) =>
      setPremiumDraft((prev) => {
        const cur = prev.hotDeals ?? { images: [] };
        return { ...prev, hotDeals: { ...cur, ...patch } };
      });
    const setHotDealImage = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const cur = prev.hotDeals ?? { images: [] };
        const next = [...(cur.images ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, hotDeals: { ...cur, images: next } };
      });

    // WAVE D: לכידת תוכן חברתי לעמוד הציבורי (מערכים, עדכונים פונקציונליים בטוחים, תקרה 6).
    const setInstaPost = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const next = [...(prev.instagramPostUrls ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, instagramPostUrls: next };
      });
    const addInstaPost = () =>
      setPremiumDraft((prev) => {
        const cur = prev.instagramPostUrls ?? [];
        if (cur.length >= 6) return prev;
        return { ...prev, instagramPostUrls: [...cur, ''] };
      });
    const setSocialVideo = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const next = [...(prev.socialVideoUrls ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, socialVideoUrls: next };
      });
    const addSocialVideo = () =>
      setPremiumDraft((prev) => {
        const cur = prev.socialVideoUrls ?? [];
        if (cur.length >= 6) return prev;
        return { ...prev, socialVideoUrls: [...cur, ''] };
      });

    // מבצע השקה אופציונלי בתוך המבצעים החמים (טקסט + מקומות שנותרו + מועד סיום).
    const patchLaunchOffer = (patch: Partial<LandingLaunchOffer>) =>
      setPremiumDraft((prev) => {
        const cur = prev.launchOffer ?? { text: '', endsAt: '' };
        return { ...prev, launchOffer: { ...cur, ...patch } };
      });

    // מיקום: הדלקת/כיבוי מקטע המיקום בעמוד הציבורי (עריכת וואטסאפ דרך setSocial שהוגדר למעלה).
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
      if (parts[1] === 'hero') {
        setHeroImage(Number(parts[2]), el.value);
      } else if (parts[1] === 'deal') {
        setHotDealImage(Number(parts[2]), el.value);
      }
    };

    return (
      <div dir="rtl">
        <div className="mb-5">
          <p className="text-sm font-medium text-emerald-600">{sk.eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold text-[#1b1715]">{sk.title}</h2>
          <p className="mt-1 text-sm text-[#8f8478]">{sk.subtitle}</p>
          <p className="mt-2 text-xs font-medium text-[#b3a690]">{progress}</p>
        </div>

        <form action={premiumFormAction} onInput={handlePremiumInput} className={cardCls}>
          <div className="space-y-4">
            {/* ── (0) כותרת הירו ── */}
            {subKey === 'hero' && (
              <>
                {/* תצוגה מקדימה חיה של ראש העמוד */}
                <div className="mb-4">
                  <span className="mb-2 block text-sm font-medium text-[#4a4038]">{p.steps.hero.previewLabel}</span>
                  <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-[#e7dfd2] bg-[#2c2522]">
                    {heroImages[0] ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={heroImages[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : null}
                    <span aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(44,37,34,0.82), rgba(44,37,34,0.25))' }} />
                    <div className="absolute inset-0 flex flex-col justify-end gap-1 p-4 text-right">
                      {premiumDraft.heroEyebrow ? <span className="text-[10px] uppercase tracking-wide text-[#e7d9c2]">{premiumDraft.heroEyebrow}</span> : null}
                      <span className="text-lg font-bold leading-tight text-white">{premiumDraft.heroHeadline || p.steps.hero.headlinePlaceholder}</span>
                      {premiumDraft.heroSubtext ? <span className="line-clamp-2 text-xs text-[#f0e9dd]">{premiumDraft.heroSubtext}</span> : null}
                      <span className="mt-1 inline-block w-fit rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#2c2522]">{premiumDraft.ctaLabel || p.steps.hero.ctaLabelPlaceholder}</span>
                    </div>
                    {premiumDraft.heroVideoUrl ? (
                      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">▶ {p.steps.hero.previewVideoBadge}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#b3a690]">{p.steps.hero.previewHint}</p>
                </div>
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
                {textField({
                  id: 'prem-hero-cta',
                  label: p.steps.hero.ctaLabelLabel,
                  value: premiumDraft.ctaLabel ?? '',
                  placeholder: p.steps.hero.ctaLabelPlaceholder,
                  onChange: (v) => patchDraft({ ctaLabel: v }),
                })}
                {textField({
                  id: 'prem-hero-video',
                  label: p.steps.hero.videoUrlLabel,
                  value: premiumDraft.heroVideoUrl ?? '',
                  placeholder: p.steps.hero.videoUrlPlaceholder,
                  onChange: (v) => patchDraft({ heroVideoUrl: v }),
                })}
                <p className="-mt-2 text-xs text-[#b3a690]">{p.steps.hero.videoUrlHint}</p>
                <div className="-mt-1">
                  <input
                    ref={heroVideoInputRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      void handleHeroVideoFile(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => heroVideoInputRef.current?.click()}
                    disabled={uploadingVideo}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#d6c8b4] bg-white px-3 py-2 text-sm font-medium text-[#4a4038] hover:bg-[#faf6ef] disabled:opacity-60"
                  >
                    {uploadingVideo ? p.steps.hero.uploadingVideo : p.steps.hero.uploadVideo}
                  </button>
                  {videoUploadError ? (
                    <p className="mt-1 text-xs text-[#b3453b]">{videoUploadError}</p>
                  ) : null}
                </div>
                <div>
                  <span className="mb-2 block text-sm font-medium text-[#4a4038]">
                    {p.steps.hero.imagesTitle}
                  </span>
                  <div className="grid grid-cols-2 gap-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i}>
                        <span className="mb-1 block text-xs font-medium text-[#8f8478]">
                          {p.steps.hero.imageLabel.replace('{n}', String(i + 1))}
                        </span>
                        <ImageUploadField
                          name={`premImg:hero:${i}`}
                          defaultValue={heroImages[i] ?? ''}
                          targetAspect={16 / 9}
                          rounded={false}
                          maxWidth={1600}
                          maxHeight={900}
                          mime="image/jpeg"
                          labels={imageLabels}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[#b3a690]">{p.steps.hero.imagesHint}</p>
                </div>
              </>
            )}

            {/* ── (1) מבצעים חמים ── */}
            {subKey === 'hotDeals' && (
              <>
                {textField({
                  id: 'prem-deals-eyebrow',
                  label: p.steps.hotDeals.eyebrowLabel,
                  value: hotDeals.eyebrow ?? '',
                  placeholder: p.steps.hotDeals.eyebrowPlaceholder,
                  onChange: (v) => patchHotDeals({ eyebrow: v }),
                })}
                {textField({
                  id: 'prem-deals-title',
                  label: p.steps.hotDeals.titleLabel,
                  value: hotDeals.title ?? '',
                  placeholder: p.steps.hotDeals.titlePlaceholder,
                  onChange: (v) => patchHotDeals({ title: v }),
                })}
                {textField({
                  id: 'prem-deals-text',
                  label: p.steps.hotDeals.textLabel,
                  value: hotDeals.text ?? '',
                  placeholder: p.steps.hotDeals.textPlaceholder,
                  onChange: (v) => patchHotDeals({ text: v }),
                  textarea: true,
                  rows: 2,
                })}
                {textField({
                  id: 'prem-deals-cta',
                  label: p.steps.hotDeals.ctaLabelLabel,
                  value: hotDeals.ctaLabel ?? '',
                  placeholder: p.steps.hotDeals.ctaLabelPlaceholder,
                  onChange: (v) => patchHotDeals({ ctaLabel: v }),
                })}
                <div>
                  <span className="mb-2 block text-sm font-medium text-[#4a4038]">
                    {p.steps.hotDeals.imagesTitle}
                  </span>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i}>
                        <span className="mb-1 block text-xs font-medium text-[#8f8478]">
                          {p.steps.hotDeals.imageLabel.replace('{n}', String(i + 1))}
                        </span>
                        <ImageUploadField
                          name={`premImg:deal:${i}`}
                          defaultValue={hotDealsImages[i] ?? ''}
                          targetAspect={1}
                          rounded={false}
                          maxWidth={1080}
                          maxHeight={1080}
                          mime="image/jpeg"
                          labels={imageLabels}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[#b3a690]">{p.steps.hotDeals.imagesHint}</p>
                </div>
                <div className="space-y-3 rounded-2xl border border-[#e7ddcd] bg-[#f7f2ea] p-4">
                  <p className="text-sm font-semibold text-[#4a4038]">
                    {p.steps.hotDeals.offerTitle}
                  </p>
                  <p className="text-xs text-[#b3a690]">{p.steps.hotDeals.offerHint}</p>
                  {textField({
                    id: 'prem-offer-text',
                    label: p.steps.hotDeals.offerTextLabel,
                    value: launchOffer?.text ?? '',
                    placeholder: p.steps.hotDeals.offerTextPlaceholder,
                    onChange: (v) => patchLaunchOffer({ text: v }),
                  })}
                  <div className="grid grid-cols-2 gap-4">
                    {textField({
                      id: 'prem-offer-spots',
                      label: p.steps.hotDeals.spotsLeftLabel,
                      value: launchOffer?.spotsLeft != null ? String(launchOffer.spotsLeft) : '',
                      placeholder: p.steps.hotDeals.spotsLeftPlaceholder,
                      onChange: (v) => {
                        const n = Number(v);
                        patchLaunchOffer({
                          spotsLeft: v.trim() !== '' && Number.isFinite(n) ? n : undefined,
                        });
                      },
                      type: 'number',
                      dir: 'ltr',
                    })}
                    {textField({
                      id: 'prem-offer-ends',
                      label: p.steps.hotDeals.endsAtLabel,
                      value: launchOffer?.endsAt ?? '',
                      placeholder: p.steps.hotDeals.endsAtPlaceholder,
                      onChange: (v) => patchLaunchOffer({ endsAt: v }),
                      type: 'date',
                      dir: 'ltr',
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── (2) מיקום + מפה ── */}
            {subKey === 'location' && (
              <>
                <div className="rounded-2xl border border-[#e7ddcd] bg-[#f7f2ea] p-4">
                  <p className="text-sm font-semibold text-[#4a4038]">
                    {p.steps.location.addressTitle}
                  </p>
                  <p className="mt-1 text-sm text-[#6e655f]">
                    {businessAddress.trim() !== '' ? businessAddress : p.steps.location.noAddress}
                  </p>
                  <p className="mt-2 text-xs text-[#b3a690]">{p.steps.location.addressHint}</p>
                </div>
                {textField({
                  id: 'prem-location-whatsapp',
                  label: p.steps.location.whatsappLabel,
                  value: social.whatsapp ?? '',
                  placeholder: p.steps.location.whatsappPlaceholder,
                  onChange: (v) => setSocial('whatsapp', v),
                  dir: 'ltr',
                })}
                <label className="flex items-center gap-3 rounded-xl border border-[#e7ddcd] px-3 py-2.5 text-sm text-[#4a4038]">
                  <input
                    type="checkbox"
                    checked={sections.location ?? false}
                    onChange={(e) => setSection('location', e.target.checked)}
                    className="h-4 w-4 rounded border-[#d6c8b4] text-emerald-600"
                  />
                  {p.steps.location.showToggle}
                </label>
                {/* ── WAVE D: לכידת תוכן חברתי שמזין את מקטעי הרשתות בעמוד הציבורי ── */}
                <div className="space-y-4 rounded-2xl border border-[#e7ddcd] bg-white p-4">
                  {/* פוסטים מאינסטגרם */}
                  <div>
                    <label className={labelCls}>{p.steps.location.instagramPostsLabel}</label>
                    <p className="-mt-0.5 mb-2 text-xs text-[#b3a690]">{p.steps.location.instagramPostsHint}</p>
                    <div className="space-y-2">
                      {(instagramPosts.length ? instagramPosts : ['']).map((v, i) => (
                        <input
                          key={i}
                          type="text"
                          dir="ltr"
                          value={v}
                          onChange={(e) => setInstaPost(i, e.target.value)}
                          placeholder={p.steps.location.instagramPostPlaceholder}
                          className={inputCls}
                        />
                      ))}
                    </div>
                    {instagramPosts.length < 6 ? (
                      <button
                        type="button"
                        onClick={addInstaPost}
                        className="mt-2 inline-flex items-center gap-1 rounded-xl border border-[#d6c8b4] bg-white px-3 py-1.5 text-sm font-medium text-[#4a4038] transition hover:bg-[#faf6ef]"
                      >
                        {p.steps.location.addMore}
                      </button>
                    ) : null}
                  </div>
                  {/* סרטונים מטיקטוק או יוטיוב */}
                  <div>
                    <label className={labelCls}>{p.steps.location.socialVideosLabel}</label>
                    <p className="-mt-0.5 mb-2 text-xs text-[#b3a690]">{p.steps.location.socialVideosHint}</p>
                    <div className="space-y-2">
                      {(socialVideos.length ? socialVideos : ['']).map((v, i) => (
                        <input
                          key={i}
                          type="text"
                          dir="ltr"
                          value={v}
                          onChange={(e) => setSocialVideo(i, e.target.value)}
                          placeholder={p.steps.location.socialVideoPlaceholder}
                          className={inputCls}
                        />
                      ))}
                    </div>
                    {socialVideos.length < 6 ? (
                      <button
                        type="button"
                        onClick={addSocialVideo}
                        className="mt-2 inline-flex items-center gap-1 rounded-xl border border-[#d6c8b4] bg-white px-3 py-1.5 text-sm font-medium text-[#4a4038] transition hover:bg-[#faf6ef]"
                      >
                        {p.steps.location.addMore}
                      </button>
                    ) : null}
                  </div>
                  {/* פיד פייסבוק: שדה מפורש בלבד, נפרד מכפתור האייקון (משמר את הניתוק מ-C.1) */}
                  <div>
                    <label htmlFor="prem-location-fbfeed" className={labelCls}>{p.steps.location.facebookFeedLabel}</label>
                    <p className="-mt-0.5 mb-2 text-xs text-[#b3a690]">{p.steps.location.facebookFeedHint}</p>
                    <input
                      id="prem-location-fbfeed"
                      type="text"
                      dir="ltr"
                      value={premiumDraft.facebookFeedUrl ?? ''}
                      onChange={(e) => patchDraft({ facebookFeedUrl: e.target.value })}
                      placeholder={p.steps.location.facebookFeedPlaceholder}
                      className={inputCls}
                    />
                    {social.facebook ? (
                      <button
                        type="button"
                        onClick={() => patchDraft({ facebookFeedUrl: social.facebook ?? '' })}
                        className="mt-2 inline-flex items-center gap-1 rounded-xl border border-[#d6c8b4] bg-white px-3 py-1.5 text-sm font-medium text-[#4a4038] transition hover:bg-[#faf6ef]"
                      >
                        {p.steps.location.facebookUseIconLink}
                      </button>
                    ) : null}
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
                className="rounded-xl border border-[#d6c8b4] px-5 py-2.5 font-semibold text-[#4a4038] transition hover:bg-[#f7f2ea]"
              >
                {p.nav.back}
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPremiumPhase(isLast ? 'summary' : sub + 1)}
                  disabled={premiumPending}
                  className="text-sm font-medium text-[#8f8478] transition hover:text-[#4a4038] disabled:opacity-60"
                >
                  {p.nav.skip}
                </button>
                <button
                  type="submit"
                  onClick={() => {
                    nextTargetRef.current = 'summary';
                  }}
                  disabled={premiumPending}
                  className="rounded-xl border border-[#d6c8b4] px-5 py-2.5 font-semibold text-[#4a4038] transition hover:bg-[#f7f2ea] disabled:opacity-60"
                >
                  {p.nav.saveExit}
                </button>
                <button
                  type="submit"
                  onClick={() => {
                    nextTargetRef.current = isLast ? 'summary' : sub + 1;
                  }}
                  disabled={premiumPending}
                  className="rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60"
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
        className="rounded-xl border border-[#d6c8b4] px-5 py-2.5 font-semibold text-[#4a4038] transition hover:bg-[#f7f2ea]"
      >
        {o.back}
      </button>
    );
  }

  return (
    <div dir="rtl">
      <div className="mb-5">
        <p className="text-sm font-medium text-emerald-600">{o[stepKey].eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-[#1b1715]">{o[stepKey].title}</h2>
        <p className="mt-1 text-sm text-[#8f8478]">{o[stepKey].subtitle}</p>
        <p className="mt-2 text-xs font-medium text-[#b3a690]">{progress}</p>
      </div>

      <div className="rounded-3xl border border-[#e7ddcd] bg-white p-5 shadow-sm sm:p-6">
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
                          : 'border-[#e7ddcd] bg-white hover:border-[#d6c8b4]')
                      }
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#2a2320]">
                          {s.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-[#8f8478]">
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
                      <span className="block truncate font-semibold text-[#2a2320]">{svc.name}</span>
                      <span className="mt-0.5 block text-xs text-[#8f8478]">
                        {svc.durationMin} {o.services.minutesSuffix} ·{' '}
                        {svc.priceAgorot > 0
                          ? `₪${(svc.priceAgorot / 100).toLocaleString('he-IL')}`
                          : o.services.free}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewService(idx)}
                      className="shrink-0 text-sm font-medium text-[#8f8478] hover:text-red-600"
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
              <div className="space-y-3 rounded-2xl border border-dashed border-[#d6c8b4] bg-[#f7f2ea] p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4a4038]">
                    {o.services.newNameLabel}
                  </label>
                  <input
                    name="newName"
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={o.services.newNamePlaceholder.replace('{example}', serviceExample)}
                    className="w-full rounded-xl border border-[#d6c8b4] bg-white px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-[#4a4038]">
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
                      className="w-full rounded-xl border border-[#d6c8b4] bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-[#4a4038]">
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
                      className="w-full rounded-xl border border-[#d6c8b4] bg-white px-3 py-2.5 text-sm"
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
                    className="text-sm font-medium text-[#8f8478] hover:text-[#4a4038]"
                  >
                    {o.services.cancelAdd}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingService(true)}
                className="w-full rounded-2xl border border-dashed border-[#d6c8b4] py-3 text-sm font-semibold text-[#8f8478] transition hover:border-emerald-300 hover:text-emerald-600"
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
                className="rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60"
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
                        : 'border-[#e7ddcd] bg-white hover:border-[#d6c8b4]')
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
                      <span className="block font-semibold text-[#2a2320]">{p.label}</span>
                      <span className="mt-0.5 block text-xs text-[#8f8478]">{p.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {preset === 'custom' ? (
              <div className="space-y-2 rounded-2xl border border-dashed border-[#d6c8b4] bg-[#f7f2ea] p-4">
                <p className="text-sm font-medium text-[#4a4038]">{o.hours.custom.title}</p>
                {customDays.map((day) => (
                  <div key={day.weekday} className="flex flex-wrap items-center gap-3">
                    <label className="flex min-w-[4.5rem] items-center gap-2">
                      <input
                        type="checkbox"
                        checked={day.open}
                        onChange={(e) => updateCustomDay(day.weekday, { open: e.target.checked })}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span className="text-sm font-medium text-[#4a4038]">
                        {o.hours.custom.days[day.weekday]}
                      </span>
                    </label>
                    {day.open ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={day.start}
                          onChange={(e) => updateCustomDay(day.weekday, { start: e.target.value })}
                          className="rounded-lg border border-[#d6c8b4] bg-white px-2 py-1.5 text-sm"
                        />
                        <span className="text-[#b3a690]">–</span>
                        <input
                          type="time"
                          value={day.end}
                          onChange={(e) => updateCustomDay(day.weekday, { end: e.target.value })}
                          className="rounded-lg border border-[#d6c8b4] bg-white px-2 py-1.5 text-sm"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-[#b3a690]">{o.hours.custom.closed}</span>
                    )}
                  </div>
                ))}
                <input type="hidden" name="customHours" value={JSON.stringify(customDays)} />
              </div>
            ) : null}

            <p className="rounded-2xl bg-[#f7f2ea] px-3 py-2.5 text-xs leading-relaxed text-[#8f8478]">
              {o.hours.staffNote}
            </p>
            <p className="text-xs text-[#b3a690]">{o.hours.tuneLater}</p>
            {errorText(hoursState) ? (
              <p className="text-sm text-red-600">{errorText(hoursState)}</p>
            ) : null}
            <div className="flex items-center justify-between pt-1">
              {backButton()}
              <button
                type="submit"
                disabled={hoursPending}
                className="rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60"
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
              <span className="mb-1.5 block text-sm font-medium text-[#4a4038]">
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

            <div className="space-y-4">
              {/* גלריית פלטות מותג אצורות: כרטיס קובע brandColor + theme לעמוד הפרימיום */}
              <div>
                <span className="mb-1.5 block text-sm font-medium text-[#4a4038]">
                  {o.premium.palette.presetsTitle}
                </span>
                <p className="mb-2 text-xs text-[#b3a690]">{o.premium.palette.presetsHint}</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {BRAND_PRESETS.map((preset) => {
                    const on =
                      (premiumDraft.theme?.brand ?? '').toLowerCase() ===
                      preset.theme.brand.toLowerCase();
                    const dots = [
                      preset.theme.brand,
                      preset.theme.brandDark,
                      preset.theme.gold,
                      preset.theme.accent,
                      preset.theme.cream,
                    ];
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setColor(preset.theme.brand);
                          setPremiumDraft((prev) => ({ ...prev, theme: preset.theme }));
                        }}
                        className={
                          'flex flex-col gap-2 rounded-2xl border p-3 text-right transition ' +
                          (on
                            ? 'border-[#1b1715] ring-2 ring-[#1b1715] ring-offset-1'
                            : 'border-[#e7ddcd] hover:border-[#b3a690]')
                        }
                      >
                        <span className="flex gap-1" aria-hidden="true">
                          {dots.map((c, di) => (
                            <span
                              key={di}
                              className="h-5 w-5 rounded-full ring-1 ring-black/5"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </span>
                        <span className="text-xs font-medium text-[#4a4038]">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* מסלול "צבע ראשי": גוונים קבועים אצורים; שאר --biz-* נגזרים אוטומטית */}
              <div>
                <span className="mb-1.5 block text-sm font-medium text-[#4a4038]">
                  {o.premium.palette.primaryTitle}
                </span>
                <p className="mb-2 text-xs text-[#b3a690]">{o.premium.palette.primaryHint}</p>
                <div className="flex flex-wrap gap-2.5">
                  {PRIMARY_SWATCHES.map((swatch) => {
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
                          (on
                            ? 'ring-2 ring-[#1b1715]'
                            : 'ring-1 ring-[#e7ddcd] hover:ring-[#b3a690]')
                        }
                      />
                    );
                  })}
                </div>
              </div>
              <input type="hidden" name="brandColor" value={color} />
            </div>

            {/* תצוגה חיה של עמוד ההזמנות — נצבעת מיד לפי הצבע שנבחר */}
            <div>
              <p className="mb-2 text-xs font-medium text-[#b3a690]">{o.branding.previewTitle}</p>
              <div className="overflow-hidden rounded-2xl border border-[#e7ddcd] shadow-sm">
                <div className="h-16" style={{ backgroundColor: color }} />
                <div className="-mt-8 px-4 pb-4">
                  <div className="flex items-end gap-3">
                    <span
                      className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white text-xl font-bold text-[#4a4038] shadow"
                      style={{ color }}
                    >
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        businessName.trim().charAt(0) || '★'
                      )}
                    </span>
                    <span className="pb-1 font-bold text-[#2a2320]">{businessName}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-[#efe6d8] bg-[#f7f2ea] px-3 py-2 text-xs text-[#8f8478]">
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
                  className="text-sm font-medium text-[#8f8478] hover:text-[#4a4038] disabled:opacity-60"
                >
                  {o.branding.skip}
                </button>
                <button
                  type="submit"
                  disabled={brandingPending}
                  className="rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60"
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
