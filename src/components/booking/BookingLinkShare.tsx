'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { t } from '@/i18n';

/**
 * שד קריאה בלבד של קישור ההזמנות עם העתקה, שיתוף מקורי (במובייל) וקוד QR מוטבע.
 * קוד ה-QR מתקבל כמחרוזת SVG מוכנה מהשרת, כדי לא להטעין ספריית QR ללקוח.
 */

type Props = {
  url: string;
  qrSvg: string;
  businessName: string;
  /** מצב קומפקטי לבאנר: מסתיר את הכותרת הפנימית ומקטין מרווחים. */
  compact?: boolean;
};

export default function BookingLinkShare({
  url,
  qrSvg,
  businessName,
  compact = false,
}: Props) {
  const s = t.admin.onboarding.goLive.share;
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    );
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function flashCopied() {
    setCopied(true);
    setCopyFailed(false);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2200);
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        flashCopied();
        return;
      }
      throw new Error('clipboard unavailable');
    } catch {
      // נפילה חלופית: סימון שדה הקלט והעתקה דרך execCommand בדפדפנים ישנים.
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.select();
        let ok = false;
        try {
          ok = document.execCommand('copy');
        } catch {
          ok = false;
        }
        input.setSelectionRange(0, 0);
        input.blur();
        if (ok) {
          flashCopied();
          return;
        }
      }
      setCopied(false);
      setCopyFailed(true);
    }
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: s.shareTitle.replace('{name}', businessName),
        text: s.shareText.replace('{name}', businessName),
        url,
      });
    } catch {
      // המשתמש ביטל את השיתוף — אין צורך בפעולה.
    }
  }

  return (
    <div dir="rtl" className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div
        className="h-40 w-40 shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />

      <div className="min-w-0 flex-1">
        {compact ? null : (
          <div className="mb-2">
            <h3 className="text-sm font-bold text-slate-900">{s.heading}</h3>
            <p className="text-sm text-slate-600">{s.subtitle}</p>
          </div>
        )}

        <label
          htmlFor={fieldId}
          className="mb-1 block text-xs font-medium text-slate-500"
        >
          {s.fieldLabel}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={fieldId}
            ref={inputRef}
            readOnly
            dir="ltr"
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-800"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              {copied ? s.copied : s.copy}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center justify-center rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
              >
                {s.nativeShare}
              </button>
            ) : null}
          </div>
        </div>

        {copyFailed ? (
          <p role="alert" className="mt-2 text-sm text-rose-600">
            {s.copyFailed}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-500">{s.qrHint}</p>
      </div>
    </div>
  );
}
