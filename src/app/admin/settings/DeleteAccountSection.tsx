'use client';

import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { requestAccountDeletion } from '../actions';

/**
 * "אזור מסוכן" בהגדרות: מחיקת המנוי. פתיחת הכפתור מציגה מודאל אדום (danger) עם
 * הסבר מלא בעברית, ושתי הגנות מפני מחיקה בשוגג: תיבת סימון "אני מבין/ה שהמידע
 * יימחק" שמפעילה את כפתור המחיקה האדום, וכפתור ביטול. האישור נשלח כ-confirm=yes
 * ופעולת השרת מאמתת אותו שוב. עם האישור החשבון מושבת מיד והבעלים מנותק.
 */
export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const c = t.admin.settings.deletion;

  // סגירה ב-Escape ונעילת גלילת הרקע כל עוד המודאל פתוח.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // איפוס תיבת הסימון בכל פתיחה מחדש, כדי שהמחיקה תמיד תדרוש אישור מכוון.
  useEffect(() => {
    if (open) setUnderstood(false);
  }, [open]);

  return (
    <section
      dir="rtl"
      className="mt-10 rounded-2xl border border-red-200 bg-red-50/60 p-5"
    >
      <h2 className="text-lg font-bold text-red-800">{c.zoneTitle}</h2>
      <p className="mt-1 text-sm leading-relaxed text-red-900/80">
        {c.zoneDescription}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 min-h-[44px] rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
      >
        {c.openButton}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <button
            type="button"
            aria-label={c.cancelButton}
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/50"
          />
          <div
            dir="rtl"
            className="relative w-full max-w-md rounded-2xl border-2 border-red-500 bg-white p-6 shadow-2xl"
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              </span>
              <h3
                id="delete-modal-title"
                className="text-xl font-bold text-red-700"
              >
                {c.confirmQuestion}
              </h3>
            </div>

            <ul className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-slate-800">
              <li className="flex gap-2">
                <span aria-hidden className="text-red-600">•</span>
                <span>{c.line14Days}</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-red-600">•</span>
                <span>{c.lineReversible}</span>
              </li>
            </ul>

            <form
              action={requestAccountDeletion}
              onSubmit={() => setSubmitting(true)}
              className="mt-5"
            >
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  name="confirm"
                  value="yes"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span>{c.checkboxLabel}</span>
              </label>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  {c.cancelButton}
                </button>
                <button
                  type="submit"
                  disabled={!understood || submitting}
                  className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {c.confirmButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
