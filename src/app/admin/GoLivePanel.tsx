'use client';

import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import InstallApp from '@/components/pwa/InstallApp';
import BookingLinkShare from '@/components/booking/BookingLinkShare';

/**
 * פאנל "העסק שלך חי!" בסיום ההקמה. מרכז שלוש יכולות:
 * (1) קישור ההזמנות עם העתקה, שיתוף וקוד QR;
 * (2) התקנת אפליקציית הניהול (PWA בהיקף /admin);
 * (3) אפליקציית ההזמנות ללקוחות (התקנה מעמוד ההזמנות עצמו) עם הקישור לשיתוף.
 *
 * ניתן לסגירה מקומית (localStorage) לפי מזהה העסק, בלי פעולת שרת נוספת.
 */

type Props = {
  url: string;
  qrSvg: string;
  businessName: string;
  bookingPath: string;
  businessId: string;
};

export default function GoLivePanel({
  url,
  qrSvg,
  businessName,
  bookingPath,
  businessId,
}: Props) {
  const g = t.admin.onboarding.goLive;
  const storageKey = `torchick_golive_dismissed_${businessId}`;
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(storageKey) === '1') setDismissed(true);
    } catch {
      // גישה ל-localStorage נחסמה — נשאיר את הפאנל גלוי.
    }
  }, [storageKey]);

  if (!mounted || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // אין אחסון מקומי — נסגור לפגישה הנוכחית בלבד.
    }
    setDismissed(true);
  }

  return (
    <section
      dir="rtl"
      className="mb-5 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 10.5l3.5 3.5L16 6" />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-bold text-[#1b1715]">{g.heading}</h2>
            <p className="text-sm text-[#6e655f]">{g.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-[#8f8478] transition hover:bg-[#efe6d8] hover:text-[#4a4038]"
        >
          {g.dismiss}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-[#e7ddcd] bg-white p-4">
        <BookingLinkShare url={url} qrSvg={qrSvg} businessName={businessName} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InstallApp variant="admin" />

        <div className="rounded-2xl border border-[#e7ddcd] bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-[#1b1715]">
            {g.customer.heading}
          </h3>
          <p className="mt-1 text-sm text-[#6e655f]">{g.customer.subtitle}</p>
          <a
            href={bookingPath}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {g.customer.openButton}
          </a>
          <p className="mt-3 text-xs text-[#8f8478]">{g.customer.hint}</p>
        </div>
      </div>
    </section>
  );
}
