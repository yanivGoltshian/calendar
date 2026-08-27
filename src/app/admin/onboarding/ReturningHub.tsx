'use client';

import { useEffect, useState } from 'react';
import BookingLinkShare from '@/components/booking/BookingLinkShare';
import { t } from '@/i18n';

/**
 * מרכז העסק החוזר (variant-1): בביקור חוזר החגיגה הגדולה מתקפלת, ובמקומה מוצג
 * hub של עסק פעיל — רצועת מצב, ארבעה קיצורים (עריכת פרימיום/יומן/עמוד ציבורי/
 * קישור הזמנות) ומגירת חגיגה שנפתחת שוב בלחיצה על «פתחו שוב». כל הקופי מ-he.ts.
 */

type Props = {
  businessName: string;
  slug: string;
  /** קישור העמוד הציבורי `/b/<slug>`. */
  pageUrl: string;
  /** קישור ההזמנות `/b/<slug>/book`. */
  bookingShareUrl: string;
  /** SVG מוכן של קוד QR לקישור ההזמנות. */
  bookingShareQr: string;
};

export default function ReturningHub({
  businessName,
  slug,
  pageUrl,
  bookingShareUrl,
  bookingShareQr,
}: Props) {
  const o = t.admin.onboarding;
  const h = o.goLiveV1.hub;
  const pagePath = `/b/${slug}`;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const whatsappText = encodeURIComponent(
    `${o.goLive.share.shareText.replace('{name}', businessName)} ${bookingShareUrl}`,
  );

  // סגירת המגירה במקש Escape ונעילת גלילת הרקע כשהיא פתוחה.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <section dir="rtl" className="flex flex-col gap-4">
      {/* צ'יפ מותג */}
      <div className="flex items-center gap-2 text-sm font-semibold text-sand-700">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent-500" />
        {h.brandchip.replace('{name}', businessName)}
      </div>

      {/* רצועת מצב + פתיחת החגיגה מחדש */}
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand-gradient px-4 py-3.5 text-white shadow-soft">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          <span className="truncate">{h.ribbon}</span>
        </span>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
        >
          {h.reopen}
        </button>
      </div>

      {/* ארבעה קיצורים */}
      <div className="flex flex-col gap-3">
        <a
          href="/admin/onboarding?edit=premium"
          className="flex items-center gap-3 rounded-2xl bg-brand-sheen px-4 py-3.5 text-white shadow-elevated transition hover:brightness-110"
        >
          <span aria-hidden="true" className="text-xl">
            ✨
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{h.rowPremiumTitle}</span>
            <span className="block text-xs text-white/70">{h.rowPremiumSub}</span>
          </span>
          <span aria-hidden="true" className="text-white/60">
            ‹
          </span>
        </a>

        <HubRow
          href="/admin"
          icon="📅"
          iconClass="bg-brand-gradient text-white"
          title={h.rowCalendarTitle}
          sub={h.rowCalendarSub}
        />
        <HubRow
          href={pageUrl}
          external
          icon="🔗"
          iconClass="bg-accent-500 text-brand-950"
          title={h.rowPageTitle}
          sub={h.rowPageSub.replace('{url}', pagePath)}
          subLtr
        />
        <HubRow
          href={bookingShareUrl}
          external
          icon="🗓️"
          iconClass="bg-emerald-500 text-white"
          title={h.rowBookingTitle}
          sub={h.rowBookingSub}
        />
      </div>

      <p className="text-xs text-sand-600">{h.footnote}</p>

      {/* מגירת החגיגה */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={o.success.title}
        >
          <button
            type="button"
            aria-label={h.close}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-brand-950/50"
          />
          <div className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-sand-200 bg-white p-5 text-start shadow-elevated motion-safe:animate-fade-up sm:p-6">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-sand-200" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label={h.close}
              className="absolute end-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-sand-600 transition hover:bg-sand-100"
            >
              ✕
            </button>

            <div className="text-center">
              <span
                aria-hidden="true"
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-glow-soft"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 12.5l5 5L20 6" />
                </svg>
              </span>
              <h2 className="mt-3 text-xl font-bold text-sand-900">{o.success.title}</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-sand-600">
                {h.drawerSubtitle.replace('{name}', businessName)}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 p-4">
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
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <span aria-hidden="true">💬</span>
                {o.goLiveV1.celebration.whatsapp}
              </a>
            </div>

            <a
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-accent-500 px-5 py-3 text-sm font-semibold text-brand-950 transition hover:bg-accent-600"
            >
              <span aria-hidden="true">🔗</span>
              {h.drawerPageCta}
              <span dir="ltr" className="text-brand-950/70">
                {pagePath}
              </span>
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// שורת קיצור בהירה עם צ'יפ אייקון צבעוני, כותרת ותת-כותרת.
function HubRow({
  href,
  icon,
  iconClass,
  title,
  sub,
  subLtr = false,
  external = false,
}: {
  href: string;
  icon: string;
  iconClass: string;
  title: string;
  sub: string;
  subLtr?: boolean;
  external?: boolean;
}) {
  const externalProps = external
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};
  return (
    <a
      href={href}
      {...externalProps}
      className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white px-4 py-3 shadow-sm transition hover:border-sand-300 hover:shadow-soft"
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${iconClass}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-sand-900">{title}</span>
        <span
          className="block truncate text-xs text-sand-600"
          dir={subLtr ? 'ltr' : undefined}
        >
          {sub}
        </span>
      </span>
      <span aria-hidden="true" className="text-sand-400">
        ‹
      </span>
    </a>
  );
}
