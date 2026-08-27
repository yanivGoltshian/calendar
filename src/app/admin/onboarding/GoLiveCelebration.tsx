'use client';

import BookingLinkShare from '@/components/booking/BookingLinkShare';
import { t } from '@/i18n';

/**
 * מסך «רגע ההשקה» (variant-1): חגיגת עליית העמוד לאוויר שמחליפה את מסך הסיכום
 * בסוף בניית עמוד הפרימיום. באנר הצלחה + קונפטי, שלושה כרטיסי CTA (פרימיום/יומן/
 * עמוד ציבורי) ומקטע שיתוף קישור ההזמנות עם QR ו-וואטסאפ. כל הקופי מ-he.ts.
 */

type Props = {
  businessName: string;
  slug: string;
  /** קישור העמוד הציבורי `/b/<slug>` (לכפתור «לעמוד שלך»). */
  pageUrl: string;
  /** קישור ההזמנות `/b/<slug>/book` (למקטע השיתוף). */
  bookingShareUrl: string;
  /** SVG מוכן של קוד QR לקישור ההזמנות. */
  bookingShareQr: string;
};

// חלקיקי קונפטי דקורטיביים (aria-hidden). צבעי המותג: נייבי/זהב/ברוקולי-אמרלד.
const CONFETTI = [
  { c: 'bg-accent-400', l: '8%', d: '0ms', r: '-18deg' },
  { c: 'bg-brand-500', l: '20%', d: '120ms', r: '12deg' },
  { c: 'bg-emerald-400', l: '33%', d: '60ms', r: '-8deg' },
  { c: 'bg-accent-500', l: '46%', d: '200ms', r: '20deg' },
  { c: 'bg-brand-400', l: '58%', d: '90ms', r: '-14deg' },
  { c: 'bg-emerald-500', l: '70%', d: '150ms', r: '6deg' },
  { c: 'bg-accent-400', l: '82%', d: '40ms', r: '-22deg' },
  { c: 'bg-brand-500', l: '92%', d: '180ms', r: '16deg' },
] as const;

export default function GoLiveCelebration({
  businessName,
  slug,
  pageUrl,
  bookingShareUrl,
  bookingShareQr,
}: Props) {
  const o = t.admin.onboarding;
  const c = o.goLiveV1.celebration;
  const pagePath = `/b/${slug}`;
  const whatsappText = encodeURIComponent(
    `${o.goLive.share.shareText.replace('{name}', businessName)} ${bookingShareUrl}`,
  );

  return (
    <section
      dir="rtl"
      className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-soft sm:p-8"
    >
      {/* קונפטי חגיגי */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 overflow-hidden"
      >
        {CONFETTI.map((p, i) => (
          <span
            key={i}
            className={`absolute top-3 h-2.5 w-2.5 rounded-[2px] ${p.c} opacity-80 motion-safe:animate-fade-up`}
            style={{ left: p.l, animationDelay: p.d, transform: `rotate(${p.r})` }}
          />
        ))}
      </div>

      {/* באנר הצלחה */}
      <span
        aria-hidden="true"
        className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-glow-soft motion-safe:animate-fade-up"
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

      <p className="relative mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">
        {c.eyebrow}
      </p>
      <h2 className="relative mt-1 text-2xl font-bold text-sand-900 sm:text-3xl">
        {o.success.title}
      </h2>
      <p className="relative mx-auto mt-2 max-w-md text-sm text-sand-600">
        {o.success.subtitle.replace('{name}', businessName)}
      </p>

      {/* שלושה כרטיסי CTA */}
      <div className="relative mt-6 flex flex-col gap-3 text-start">
        <a
          href="/admin/onboarding?edit=premium"
          className="group flex items-center gap-3 rounded-2xl bg-brand-sheen px-4 py-3.5 text-white shadow-elevated transition hover:brightness-110"
        >
          <span aria-hidden="true" className="text-xl">
            ✨
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{c.ctaPremiumTitle}</span>
            <span className="block text-xs text-white/70">{c.ctaPremiumSub}</span>
          </span>
          <span aria-hidden="true" className="text-white/60">
            ‹
          </span>
        </a>

        <a
          href="/admin"
          className="group flex items-center gap-3 rounded-2xl bg-brand-gradient px-4 py-3.5 text-white shadow-soft transition hover:brightness-110"
        >
          <span aria-hidden="true" className="text-xl">
            📅
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{c.ctaCalendarTitle}</span>
            <span className="block text-xs text-white/70">{c.ctaCalendarSub}</span>
          </span>
          <span aria-hidden="true" className="text-white/60">
            ‹
          </span>
        </a>

        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-2xl bg-accent-500 px-4 py-3.5 text-brand-950 shadow-soft transition hover:bg-accent-600"
        >
          <span aria-hidden="true" className="text-xl">
            🔗
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{c.ctaPageTitle}</span>
            <span className="block text-xs text-brand-950/70" dir="ltr">
              {c.ctaPageSub.replace('{url}', pagePath)}
            </span>
          </span>
          <span aria-hidden="true" className="text-brand-950/50">
            ‹
          </span>
        </a>
      </div>

      {/* מקטע שיתוף קישור ההזמנות */}
      <div className="relative mt-6 rounded-2xl border border-sand-200 bg-white p-4 text-start shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-sand-900">{c.bookingCardTitle}</h3>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {c.bookingPill}
          </span>
        </div>
        <BookingLinkShare
          compact
          url={bookingShareUrl}
          qrSvg={bookingShareQr}
          businessName={businessName}
        />
        <a
          href={`https://wa.me/?text=${whatsappText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 sm:w-auto"
        >
          <span aria-hidden="true">💬</span>
          {c.whatsapp}
        </a>
      </div>

      <p className="relative mt-5 text-xs text-sand-600">{c.footnote}</p>
    </section>
  );
}
