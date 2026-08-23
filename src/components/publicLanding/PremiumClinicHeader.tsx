'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LandingLaunchOffer } from '@/lib/publicPageStyle';
import { logout } from '@/app/account/actions';
import { computeCountdown } from '@/lib/launchOffer';
import { formatIsraeliPhoneDisplay } from '@/lib/phoneDisplay';
import {
  PhoneIcon,
  ClockIcon,
  InstagramIcon,
  FacebookIcon,
  ArrowLeftIcon,
  MegaphoneIcon,
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
  offerSpotsCalm: string;
  offerRemaining: string;
  offerEndsIn: string;
  offerClose: string;
  callAria: string;
  instagramAria: string;
  facebookAria: string;
  heroImageAlt: string;
  heroSecondaryCta: string;
  updatesLabel: string;
  menu: {
    open: string;
    close: string;
    title: string;
    account: string;
    login: string;
    logout: string;
    connectedLabel: string;
    guestLabel: string;
  };
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
  heroVideoUrl?: string | null; // וידאו הירו אופציונלי — מוצג בצד ההירו במקום התמונה הראשית
  heroPosterUrl?: string | null; // פוסטר לווידאו ההירו
  heroEyebrow?: string;
  heroHeadline: string;
  heroSubtext: string;
  heroTagline?: string | null; // תת־כותרת מותגית מתחת לפס הזהב (צבע המותג)
  heroCtaLabel: string;
  updatesText?: string | null;
  launchOffer?: LandingLaunchOffer | null;
  // מצב ההתחברות של הלקוח לתפריט ההמבורגר (null = אורח/ת לא מחובר/ת).
  account?: { name?: string | null; email?: string | null } | null;
  accountHref?: string;
  loginHref?: string;
  labels: Labels;
};

// מקטע חתום #2 — כותרת + הירו + פס מבצע לעמוד הקליניקה הפרימיום.
// סרגל עליון כהה (טלפון · שעות היום · רשתות), שורת ניווט בגוון קרם עם כפתור זהב
// "לקביעת תור" שפותח את אשף קביעת התור, פס מבצע עדין (טקסט · מקומות · ימים בלבד,
// ללא שעון מתקתק) שמוסתר כשאין מבצע או כשהסתיים, והירו מפוצל עם וידאו או תמונות. RTL מלא ונגיש.
export default function PremiumClinicHeader({
  name,
  logoUrl,
  phone,
  todayHours,
  instagramUrl,
  facebookUrl,
  bookHref,
  heroImages,
  heroVideoUrl,
  heroPosterUrl,
  heroEyebrow,
  heroHeadline,
  heroSubtext,
  heroTagline,
  heroCtaLabel,
  updatesText,
  launchOffer,
  account = null,
  accountHref = '/account',
  loginHref = '/login',
  labels,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const phoneDisplay = formatIsraeliPhoneDisplay(phone);
  // פס המבצע מוצג רק כשיש מבצע תקין ולא הסתיים. הספירה מחושבת פעם אחת (ימים בלבד),
  // בלי טיימר מתקתק — כך אין קפיצה, אין לחץ, ואין אי-התאמת הידרציה.
  const countdown = launchOffer ? computeCountdown(launchOffer.endsAt) : null;
  const showOffer = Boolean(launchOffer) && Boolean(countdown) && !countdown!.expired;

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
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="tc-clinic-menu"
              aria-label={menuOpen ? labels.menu.close : labels.menu.open}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--c-gold,#c6a86a)]/40 text-[color:var(--c-ink,#1b1715)] transition hover:bg-[color:var(--c-gold,#c6a86a)]/10 sm:hidden"
            >
              {menuOpen ? (
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </nav>
        </div>

        {/* מגירת תפריט מובייל — ניווט + מצב התחברות הלקוח. גלויה רק כשפתוחה ורק במובייל. */}
        {menuOpen ? (
          <div id="tc-clinic-menu" className="sm:hidden">
            <div className="mx-auto max-w-5xl px-5 pb-4">
              <nav className="flex flex-col gap-1 border-t border-[color:var(--c-gold,#c6a86a)]/20 pt-3">
                <a
                  href="#lp-services"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-[color:var(--c-ink,#1b1715)]/85 transition hover:bg-[color:var(--c-gold,#c6a86a)]/10"
                >
                  {labels.navServices}
                </a>
                <a
                  href="#lp-offers"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-[color:var(--c-ink,#1b1715)]/85 transition hover:bg-[color:var(--c-gold,#c6a86a)]/10"
                >
                  {labels.navOffers}
                </a>
                <a
                  href="#lp-location"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-[color:var(--c-ink,#1b1715)]/85 transition hover:bg-[color:var(--c-gold,#c6a86a)]/10"
                >
                  {labels.navLocation}
                </a>
              </nav>

              <div className="mt-3 rounded-2xl border border-[color:var(--c-gold,#c6a86a)]/25 bg-white/60 p-3">
                {account ? (
                  <>
                    <div className="flex flex-col gap-0.5 px-1 pb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--biz-strong)]">
                        {labels.menu.connectedLabel}
                      </span>
                      {account.name ? (
                        <span className="truncate text-sm font-bold text-[color:var(--c-ink,#1b1715)]">
                          {account.name}
                        </span>
                      ) : null}
                      {account.email ? (
                        <span dir="ltr" className="truncate text-start text-xs text-[color:var(--c-ink,#1b1715)]/70">
                          {account.email}
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={accountHref}
                      onClick={() => setMenuOpen(false)}
                      className="mt-1 block rounded-xl bg-[color:var(--c-gold,#c6a86a)]/15 px-3 py-2.5 text-center text-sm font-bold text-[color:var(--biz-strong)] transition hover:bg-[color:var(--c-gold,#c6a86a)]/25"
                    >
                      {labels.menu.account}
                    </Link>
                    <form action={logout} className="mt-2">
                      <button
                        type="submit"
                        className="block w-full rounded-xl border border-[color:var(--c-ink,#1b1715)]/15 px-3 py-2.5 text-center text-sm font-medium text-[color:var(--c-ink,#1b1715)]/80 transition hover:bg-[color:var(--c-ink,#1b1715)]/5"
                      >
                        {labels.menu.logout}
                      </button>
                    </form>
                  </>
                ) : (
                  <Link
                    href={loginHref}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl bg-[color:var(--c-gold,#c6a86a)]/15 px-3 py-2.5 text-center text-sm font-bold text-[color:var(--biz-strong)] transition hover:bg-[color:var(--c-gold,#c6a86a)]/25"
                  >
                    {labels.menu.login}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* רצועת עדכונים — טקסט מתגלגל שנשלט מניהול העסק (חופשה · זמינות · הודעה). נופלת חזרה לפס מבצע כשאין עדכון */}
      {updatesText ? (
        <div className="tc-ticker overflow-hidden bg-[color:var(--c-ink,#1b1715)] text-[color:var(--c-cream,#faf6ef)]">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-2.5">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--c-gold,#c6a86a)]">
              <MegaphoneIcon className="h-4 w-4" />
              {labels.updatesLabel}
            </span>
            <div className="relative flex-1 overflow-hidden">
              <div className="tc-ticker-track" dir="ltr">
                <span className="px-8 text-sm font-medium">{updatesText}</span>
                <span className="px-8 text-sm font-medium" aria-hidden>
                  {updatesText}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : showOffer && launchOffer && countdown ? (
        <div
          className="text-[#f4e9d6]"
          style={{ backgroundImage: 'linear-gradient(90deg, var(--biz-ink) 0%, var(--biz-ink-strong) 100%)' }}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-5 py-2.5 text-center text-xs font-semibold sm:text-sm">
            <span>{launchOffer.text}</span>
            {typeof launchOffer.spotsLeft === 'number' ? (
              <>
                <span aria-hidden className="text-[color:var(--c-gold,#c6a86a)]">·</span>
                <span>
                  {labels.offerRemaining}{' '}
                  <b className="font-bold text-white">{launchOffer.spotsLeft}</b> {labels.offerSpotsCalm}
                </span>
              </>
            ) : null}
            {countdown.days > 0 ? (
              <>
                <span aria-hidden className="text-[color:var(--c-gold,#c6a86a)]">·</span>
                <span>
                  {labels.offerRemaining}{' '}
                  <b dir="ltr" className="font-bold tabular-nums text-white">{countdown.days}</b> {labels.countdown.days}
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* הירו מלא רוחב — תמונה ראשית ברקע, וידאו בצד, טקסט לבן על מסכת ברונזה חמה. RTL מלא */}
      <section className="relative isolate flex min-h-[520px] items-center overflow-hidden text-white sm:min-h-[600px]">
        <div className="absolute inset-0 -z-10">
          {primary ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primary} alt={labels.heroImageAlt} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span aria-hidden className="absolute inset-0 bg-[color:var(--c-ink,#1b1715)]" />
          )}
          {heroVideoUrl ? (
            <div className="absolute inset-y-0 left-0 w-[46%] overflow-hidden sm:w-[34%]">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                autoPlay
                muted
                loop
                playsInline
                poster={heroPosterUrl ?? secondary ?? undefined}
                aria-label={labels.heroImageAlt}
                className="h-full w-full object-cover"
              >
                <source src={heroVideoUrl} type="video/mp4" />
              </video>
              {/* נוצת מעבר בקצה הפנימי של הווידאו */}
              <span
                aria-hidden
                className="absolute inset-y-0 right-0 w-24"
                style={{ background: 'linear-gradient(to left, rgba(44,37,34,0.72), transparent)' }}
              />
            </div>
          ) : null}
          {/* מסכת ברונזה להקראת טקסט לבן + זוהר תחתון חמים */}
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, rgba(44,37,34,0.14), rgba(44,37,34,0.5) 52%, rgba(44,37,34,0.88))' }}
          />
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(140,103,72,0.38), transparent 58%)' }}
          />
        </div>

        <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
          <div className="max-w-xl">
            {heroEyebrow ? (
              <span className="inline-flex items-center rounded-full border border-[color:var(--c-gold,#c6a86a)]/45 bg-white/10 px-4 py-1.5 text-xs font-bold tracking-[0.02em] text-[color:var(--c-gold,#c6a86a)] backdrop-blur-sm">
                {heroEyebrow}
              </span>
            ) : null}
            <h1
              className={`${heroEyebrow ? 'mt-5' : ''} font-display text-4xl font-black leading-[1.08] tracking-tight text-white drop-shadow-sm sm:text-5xl`}
            >
              {heroHeadline}
            </h1>
            <span
              aria-hidden
              className="mt-5 block h-[3px] w-24 rounded-full bg-gradient-to-l from-[color:var(--c-gold,#c6a86a)] to-[color:var(--c-gold-strong,#a6863f)]"
            />
            {heroTagline ? (
              <p
                className="mt-4 text-sm font-bold tracking-wide sm:text-base"
                style={{ color: 'var(--c-brand,#b0855f)' }}
              >
                {heroTagline}
              </p>
            ) : null}
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/85 sm:text-lg">
              {heroSubtext}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={bookHref}
                className="group inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-bold text-white shadow-elevated transition hover:-translate-y-0.5"
                style={{ backgroundImage: 'linear-gradient(to left, #c08f86, #a06c63)' }}
              >
                {heroCtaLabel}
                <ArrowLeftIcon className="h-4 w-4 transition group-hover:-translate-x-1" />
              </Link>
              <a
                href="#lp-services"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                {labels.heroSecondaryCta}
              </a>
            </div>
          </div>
        </div>
      </section>
    </header>
  );
}
