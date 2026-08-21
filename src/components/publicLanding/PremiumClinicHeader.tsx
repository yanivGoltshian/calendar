'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LandingLaunchOffer } from '@/lib/publicPageStyle';
import { computeCountdown, type Countdown } from '@/lib/launchOffer';
import { formatIsraeliPhoneDisplay } from '@/lib/phoneDisplay';
import { socialHref } from '@/lib/socialLinks';
import {
  PhoneIcon,
  ClockIcon,
  InstagramIcon,
  FacebookIcon,
  ArrowLeftIcon,
} from './icons';

type CountdownLabels = { days: string; hours: string; minutes: string; seconds: string };

type Labels = {
  bookCta: string;
  navServices: string;
  navOffers: string;
  navLocation: string;
  hoursToday: string;
  closedToday: string;
  offerSpots: string;
  offerEndsIn: string;
  offerClose: string;
  callAria: string;
  instagramAria: string;
  facebookAria: string;
  heroImageAlt: string;
  heroSecondaryCta: string;
  countdown: CountdownLabels;
};

type Props = {
  name: string;
  logoUrl?: string | null;
  phone?: string | null;
  todayHours?: string | null; // "10:00–20:00" או null כשסגור היום
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  bookHref: string;
  heroImages: string[]; // עד שתי תמונות (ראשית + פנים הקליניקה)
  heroEyebrow?: string;
  heroHeadline: string;
  heroSubtext: string;
  heroCtaLabel: string;
  launchOffer?: LandingLaunchOffer | null;
  labels: Labels;
};

// יחידת ספירה-לאחור בודדת. רוחב קבוע (tabular-nums + min-w) מונע קפיצת פריסה
// בין ספרות. עד להרכבה (mount) מוצג מציין "--" באותו מימד כדי למנוע hydration mismatch.
function CountdownCell({ value, label, mounted }: { value: number; label: string; mounted: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span
        suppressHydrationWarning
        dir="ltr"
        className="min-w-[2ch] text-center text-base font-bold tabular-nums sm:text-lg"
      >
        {mounted ? String(value).padStart(2, '0') : '--'}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</span>
    </div>
  );
}

// מקטע חתום #2 — כותרת + הירו + פס מבצע לעמוד הקליניקה הפרימיום.
// סרגל עליון כהה (טלפון · שעות היום · רשתות), שורת ניווט בגוון קרם עם כפתור זהב
// "לקביעת תור" שפותח את אשף קביעת התור, פס מבצע נסגר עם ספירה-לאחור מ-launchOffer
// (מוסתר כשאין מבצע או כשהסתיים), והירו מפוצל עם שתי תמונות. RTL מלא ונגיש.
export default function PremiumClinicHeader({
  name,
  logoUrl,
  phone,
  todayHours,
  instagramUrl,
  facebookUrl,
  bookHref,
  heroImages,
  heroEyebrow,
  heroHeadline,
  heroSubtext,
  heroCtaLabel,
  launchOffer,
  labels,
}: Props) {
  // מצב ההרכבה (mount) — מונע אי-התאמת הידרציה בספרות התלויות בזמן.
  const [mounted, setMounted] = useState(false);
  const [closed, setClosed] = useState(false);
  const [cd, setCd] = useState<Countdown>(() =>
    launchOffer ? computeCountdown(launchOffer.endsAt) : { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 },
  );

  useEffect(() => {
    if (!launchOffer) return;
    setMounted(true);
    const id = setInterval(() => setCd(computeCountdown(launchOffer.endsAt)), 1000);
    return () => clearInterval(id);
  }, [launchOffer]);

  const phoneDisplay = formatIsraeliPhoneDisplay(phone);
  // פס המבצע מוצג רק כשיש מבצע תקין, לא נסגר, ולא הסתיים (על השרת ובלקוח מסכימים – תאריך עתידי).
  const showOffer = Boolean(launchOffer) && !closed && !cd.expired;

  const primary = heroImages[0];
  const secondary = heroImages[1];

  return (
    <header className="overflow-hidden bg-[color:var(--c-cream,#faf6ef)]">
      {/* סרגל עליון כהה — טלפון, שעות היום ורשתות חברתיות */}
      <div className="bg-[color:var(--c-ink,#1b1715)] text-[color:var(--c-cream,#faf6ef)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-2 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {phone ? (
              <a
                href={`tel:${phone}`}
                aria-label={labels.callAria}
                className="inline-flex items-center gap-1.5 opacity-90 transition hover:opacity-100"
              >
                <PhoneIcon className="h-3.5 w-3.5" />
                <span dir="ltr" className="tabular-nums">{phoneDisplay}</span>
              </a>
            ) : null}
            <span className="inline-flex items-center gap-1.5 opacity-90">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>
                {labels.hoursToday}:{' '}
                {todayHours ? (
                  <span dir="ltr" className="tabular-nums">{todayHours}</span>
                ) : (
                  labels.closedToday
                )}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={labels.instagramAria}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition hover:bg-[color:var(--c-gold,#c6a86a)] hover:text-[color:var(--c-ink,#1b1715)]"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            ) : null}
            {facebookUrl ? (
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={labels.facebookAria}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition hover:bg-[color:var(--c-gold,#c6a86a)] hover:text-[color:var(--c-ink,#1b1715)]"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* שורת ניווט בגוון קרם — לוגו ושם לצד עוגני ניווט וכפתור זהב לקביעת תור */}
      <div className="border-b border-[color:var(--c-gold,#c6a86a)]/30">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--c-gold,#c6a86a)]/40 bg-white shadow-soft sm:h-12 sm:w-12">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={name} className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-lg font-bold text-[color:var(--biz-strong)]">{name.charAt(0)}</span>
              )}
            </span>
            <span className="font-display text-lg font-bold text-[color:var(--c-ink,#1b1715)] sm:text-xl">
              {name}
            </span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#lp-services"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-[color:var(--c-ink,#1b1715)]/80 transition hover:text-[color:var(--biz-strong)] sm:inline-block"
            >
              {labels.navServices}
            </a>
            <a
              href="#lp-offers"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-[color:var(--c-ink,#1b1715)]/80 transition hover:text-[color:var(--biz-strong)] sm:inline-block"
            >
              {labels.navOffers}
            </a>
            <a
              href="#lp-location"
              className="hidden rounded-full px-3 py-2 text-sm font-medium text-[color:var(--c-ink,#1b1715)]/80 transition hover:text-[color:var(--biz-strong)] sm:inline-block"
            >
              {labels.navLocation}
            </a>
            <Link
              href={bookHref}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[color:var(--c-gold,#c6a86a)] to-[color:var(--c-gold-strong,#a6863f)] px-5 py-2.5 text-sm font-bold text-[color:var(--c-ink,#1b1715)] shadow-soft transition hover:-translate-y-0.5"
            >
              {labels.bookCta}
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </div>

      {/* פס מבצע ההשקה — ספירה-לאחור מ-launchOffer, נסגר ומוסתר כשהסתיים */}
      {showOffer && launchOffer ? (
        <div className="bg-gradient-to-l from-[color:var(--biz-strong)] to-[color:var(--biz)] text-[color:var(--biz-ink)]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 py-2.5 sm:justify-between">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold sm:text-base">
              <span>{launchOffer.text}</span>
              {typeof launchOffer.spotsLeft === 'number' ? (
                <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
                  {launchOffer.spotsLeft} {labels.offerSpots}
                </span>
              ) : null}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium opacity-90">{labels.offerEndsIn}</span>
              <div className="flex items-center gap-2" role="timer" aria-live="off">
                <CountdownCell value={cd.days} label={labels.countdown.days} mounted={mounted} />
                <span aria-hidden className="pb-3 text-base font-bold opacity-70">:</span>
                <CountdownCell value={cd.hours} label={labels.countdown.hours} mounted={mounted} />
                <span aria-hidden className="pb-3 text-base font-bold opacity-70">:</span>
                <CountdownCell value={cd.minutes} label={labels.countdown.minutes} mounted={mounted} />
                <span aria-hidden className="pb-3 text-base font-bold opacity-70">:</span>
                <CountdownCell value={cd.seconds} label={labels.countdown.seconds} mounted={mounted} />
              </div>
              <button
                type="button"
                onClick={() => setClosed(true)}
                aria-label={labels.offerClose}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/30"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* הירו המפוצל — טקסט לצד קולאז' שתי תמונות. יחסי גובה-רוחב קבועים ללא קפיצה */}
      <div className="mx-auto grid max-w-5xl items-center gap-8 px-5 py-12 sm:py-16 lg:grid-cols-2 lg:py-20">
        <div className="max-w-xl">
          {heroEyebrow ? (
            <span className="inline-flex items-center rounded-full border border-[color:var(--c-gold,#c6a86a)]/50 bg-[color:var(--biz-soft)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--biz-strong)]">
              {heroEyebrow}
            </span>
          ) : null}
          <h1
            className={`${heroEyebrow ? 'mt-4' : ''} font-display text-4xl font-bold leading-[1.1] tracking-tight text-[color:var(--c-ink,#1b1715)] sm:text-5xl`}
          >
            {heroHeadline}
          </h1>
          <span
            aria-hidden
            className="mt-5 block h-0.5 w-20 rounded-full bg-gradient-to-l from-[color:var(--c-gold,#c6a86a)] to-[color:var(--c-gold-strong,#a6863f)]"
          />
          <p className="mt-5 text-base leading-relaxed text-[color:var(--c-ink,#1b1715)]/75 sm:text-lg">
            {heroSubtext}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={bookHref}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[color:var(--biz)] to-[color:var(--biz-strong)] px-8 py-3.5 text-base font-bold text-[color:var(--biz-ink)] shadow-elevated transition hover:-translate-y-0.5"
            >
              {heroCtaLabel}
              <ArrowLeftIcon className="h-4 w-4 transition group-hover:-translate-x-1" />
            </Link>
            <a
              href="#lp-services"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--biz-border)] px-7 py-3.5 text-base font-semibold text-[color:var(--biz-strong)] transition hover:border-[color:var(--biz)] hover:bg-[color:var(--biz-soft)]"
            >
              {labels.heroSecondaryCta}
            </a>
          </div>
        </div>

        {primary ? (
          <div className="grid grid-cols-5 grid-rows-6 gap-3">
            <div className="col-span-3 row-span-6 overflow-hidden rounded-3xl border border-[color:var(--c-gold,#c6a86a)]/30 shadow-elevated">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={primary} alt={labels.heroImageAlt} className="h-full w-full object-cover" />
            </div>
            {secondary ? (
              <div className="col-span-2 row-span-6 overflow-hidden rounded-3xl border border-[color:var(--c-gold,#c6a86a)]/30 shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={secondary} alt="" className="h-full w-full object-cover" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
