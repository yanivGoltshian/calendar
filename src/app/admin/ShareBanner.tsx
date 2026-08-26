'use client';

import { useState } from 'react';
import { t } from '@/i18n';
import BookingLinkShare from '@/components/booking/BookingLinkShare';

/**
 * באנר שיתוף קבוע ובולט בראש עמוד הניהול, מוצג כל עוד העסק חי.
 * מציג בכל רגע דרך מהירה לשתף את קישור ההזמנות, ונפתח לתצוגת הקישור, ההעתקה,
 * השיתוף וקוד ה-QR באותו רכיב משותף של הפאנל.
 */

type Props = {
  url: string;
  qrSvg: string;
  businessName: string;
  landingPath: string;
};

export default function ShareBanner({ url, qrSvg, businessName, landingPath }: Props) {
  const b = t.admin.onboarding.goLive.banner;
  const [open, setOpen] = useState(false);

  return (
    <section
      dir="rtl"
      className="mb-5 rounded-2xl border border-brand-100 bg-brand-50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-brand-800">{b.heading}</h2>
          <p className="text-sm text-brand-700">{b.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={landingPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-50"
          >
            {b.viewPage}
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {open ? b.close : b.open}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 rounded-xl border border-brand-100 bg-white p-4">
          <BookingLinkShare
            url={url}
            qrSvg={qrSvg}
            businessName={businessName}
            compact
          />
        </div>
      ) : null}
    </section>
  );
}
