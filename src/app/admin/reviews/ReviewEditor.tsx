'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/i18n';
import {
  REVIEW_NAME_LIMIT,
  REVIEW_TEXT_LIMIT,
  type AdminBusinessReview,
  type ReviewActionState,
} from '@/lib/businessReviews';
import RatingInput from '@/components/reviews/RatingInput';
import ReviewStars from '@/components/reviews/ReviewStars';
import ReviewCard from '@/components/reviews/ReviewCard';
import { saveBusinessReviewAction } from './actions';

const initial: ReviewActionState = { ok: false };
const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] bg-white px-3 py-2 text-[#1b1715]';
const buttonClass =
  'min-h-11 rounded-lg border border-[#d6c8b4] px-4 py-2 text-sm font-semibold disabled:opacity-60';

export default function ReviewEditor({
  review,
  onSaved,
  onCancel,
}: {
  review?: AdminBusinessReview;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(saveBusinessReviewAction, initial);
  const [name, setName] = useState(review?.name ?? '');
  const [text, setText] = useState(review?.text ?? '');
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [requestKey, setRequestKey] = useState('');
  const [confirmHide, setConfirmHide] = useState(false);
  const handled = useRef<ReviewActionState | null>(null);
  const router = useRouter();
  const labels = t.reviews;
  const customer = review?.origin === 'CUSTOMER';
  useEffect(() => {
    setRequestKey(crypto.randomUUID());
  }, []);
  useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state;
      router.refresh();
      onSaved();
    }
  }, [state, router, onSaved]);
  return (
    <section className="rounded-xl border border-[#d6c8b4] bg-[#fbf8f2] p-4 sm:p-5">
      <h2 className="mb-4 text-lg font-bold">
        {review ? labels.editTitle : labels.manualTitle}
      </h2>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <form action={action} aria-busy={pending}>
          <input type="hidden" name="mode" value={review ? 'edit' : 'create'} />
          <input type="hidden" name="requestKey" value={requestKey} />
          {review ? (
            <>
              <input type="hidden" name="id" value={review.id} />
              <input type="hidden" name="version" value={review.version} />
            </>
          ) : null}
          <fieldset disabled={pending || !requestKey} className="space-y-4">
            {review ? (
              <p className="font-semibold">{review.name}</p>
            ) : (
              <label className="block space-y-1">
                <span className="text-sm font-semibold">
                  {labels.name} · {labels.required}
                </span>
                <input
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={REVIEW_NAME_LIMIT}
                  className={inputClass}
                />
              </label>
            )}
            {customer ? (
              <>
                <div className="rounded-lg border border-[#e7ddcd] bg-white p-3">
                  <h3 className="mb-1 text-sm font-semibold">{labels.originalHeading}</h3>
                  <p className="whitespace-pre-line break-words text-sm">
                    {review.originalText || labels.ratingOnly}
                  </p>
                </div>
                <input type="hidden" name="rating" value={review.rating} />
                <ReviewStars rating={review.rating} />
                <p className="text-xs text-slate-600">
                  {labels.customerRating} {labels.editHint}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">{labels.manualHint}</p>
                <RatingInput value={rating} onChange={setRating} />
              </>
            )}
            <label className="block space-y-1">
              <span className="text-sm font-semibold">
                {labels.text} · {labels.optional}
              </span>
              <textarea
                name="text"
                rows={4}
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={REVIEW_TEXT_LIMIT}
                className={inputClass}
              />
              <span className="block text-xs text-slate-500">
                {labels.counter.replace('{count}', String(text.length))}
              </span>
            </label>
            {state.error ? (
              <p role="alert" className="text-sm text-red-700">
                {labels.errors[state.error]}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                name="status"
                value={review?.status ?? 'PENDING'}
                className={buttonClass}
              >
                {pending ? labels.saving : review ? labels.save : labels.savePending}
              </button>
              {review?.status !== 'PUBLISHED' ? (
                <button
                  type="submit"
                  name="status"
                  value="PUBLISHED"
                  className={`${buttonClass} bg-[#102039] text-white`}
                >
                  {review ? labels.publish : labels.addPublish}
                </button>
              ) : null}
              {review && review.status !== 'HIDDEN' ? (
                <button
                  type="button"
                  onClick={() => setConfirmHide(true)}
                  className={buttonClass}
                >
                  {labels.hide}
                </button>
              ) : null}
              <button type="button" onClick={onCancel} className={buttonClass}>
                {labels.cancel}
              </button>
            </div>
            {confirmHide ? (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm">{labels.hideHint}</p>
                <button
                  type="submit"
                  name="status"
                  value="HIDDEN"
                  className={buttonClass}
                >
                  {labels.hide}
                </button>
              </div>
            ) : null}
          </fieldset>
        </form>
        <aside className="space-y-2">
          <h3 className="text-sm font-semibold">{labels.preview}</h3>
          <ReviewCard
            review={{
              name,
              rating: rating || undefined,
              quote: text,
              source: 'torchick',
              editedByBusiness: customer && text.trim() !== review.originalText,
              originalQuote: customer ? review.originalText : undefined,
            }}
          />
        </aside>
      </div>
    </section>
  );
}
