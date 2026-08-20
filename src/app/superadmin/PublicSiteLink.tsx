'use client';

import { useState } from 'react';
import { t } from '@/i18n';

const s = t.billing.superadmin.publicSite;

// פלטת קונסולת ניהול-העל (נייבי-זהב), מוטבעת כדי להתאים לרכיב השרת שסביבו.
const GOLD_LIGHT = '#F2D695';
const GOLD_MID = '#C59D5F';
const TEXT_MUTED = '#9AA7BD';

/**
 * קישור לאתר הציבורי של העסק (/b/[slug]) מתוך שורת העסק בקונסולת ניהול-העל,
 * עם כפתור העתקת הקישור המלא. רכיב לקוח (navigator.clipboard) קטן ומבודד,
 * כדי שדף ניהול-העל יישאר רכיב שרת. יעדי הקשה >=44px, ידידותי למובייל ו-RTL.
 */
export default function PublicSiteLink({ slug }: { slug: string }) {
  const href = `/b/${slug}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${href}` : href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // דפדפנים ללא הרשאת clipboard: משאירים את הקישור הישיר כחלופה.
    }
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
        style={{ color: GOLD_LIGHT }}
      >
        <span aria-hidden>↗</span>
        {s.view}
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={s.copyAria}
        className="inline-flex min-h-[44px] items-center text-xs font-medium underline-offset-2 hover:underline"
        style={{ color: copied ? GOLD_MID : TEXT_MUTED }}
      >
        {copied ? s.copied : s.copy}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? s.copied : ''}
      </span>
    </div>
  );
}
