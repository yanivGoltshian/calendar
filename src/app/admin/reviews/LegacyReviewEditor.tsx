'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n';
import { saveLegacyReviewAction, type LegacyReviewActionState } from './actions';
import type { LegacyAdminReview } from './ReviewsManager';

const initial: LegacyReviewActionState = { ok: false };
const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] bg-white px-3 py-2 text-[#1b1715]';

export default function LegacyReviewEditor({
  review,
  index,
  onSaved,
  onCancel,
}: {
  review: LegacyAdminReview;
  index: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveLegacyReviewAction, initial);
  const [name, setName] = useState(review.name ?? '');
  const [quote, setQuote] = useState(review.quote);
  const [rating, setRating] = useState(review.rating ? String(review.rating) : '');
  const handled = useRef<LegacyReviewActionState | null>(null);
  const router = useRouter();
  const labels = t.reviews;

  useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state;
      router.refresh();
      onSaved();
    }
  }, [onSaved, router, state]);

  return (
    <form
      action={action}
      className="space-y-4 rounded-lg bg-[#fbf8f2] p-4"
      aria-busy={pending}
    >
      <input type="hidden" name="index" value={index} />
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{labels.name}</span>
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{labels.text}</span>
        <textarea
          name="quote"
          value={quote}
          onChange={(event) => setQuote(event.target.value)}
          className={inputClass}
          rows={4}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">{labels.rating}</span>
        <input
          name="rating"
          type="number"
          min="1"
          max="5"
          step="1"
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          className={inputClass}
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {labels.errors[state.error]}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-[#102039] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? labels.saving : labels.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg border border-[#d6c8b4] px-4 text-sm font-semibold"
        >
          {labels.cancel}
        </button>
      </div>
    </form>
  );
}
