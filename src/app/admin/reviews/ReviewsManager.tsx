'use client';

import { useState } from 'react';
import Link from 'next/link';
import { t } from '@/i18n';
import type { AdminBusinessReview, ReviewStatus } from '@/lib/businessReviews';
import ReviewCard, { type ReviewCardContent } from '@/components/reviews/ReviewCard';
import ReviewEditor from './ReviewEditor';

export type LegacyAdminReview = ReviewCardContent & { status: ReviewStatus };

export default function ReviewsManager({
  reviews,
  legacyReviews,
  slug,
  initialStatus,
  selectedReviewId,
}: {
  reviews: AdminBusinessReview[];
  legacyReviews: LegacyAdminReview[];
  slug: string;
  initialStatus?: ReviewStatus;
  selectedReviewId?: string;
}) {
  const [status, setStatus] = useState<ReviewStatus | 'all'>(initialStatus ?? 'all');
  const [source, setSource] = useState('all');
  const [editing, setEditing] = useState<string | null>(selectedReviewId ?? null);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(false);
  const labels = t.reviews;
  const counts = (value: ReviewStatus) =>
    reviews.filter((review) => review.status === value).length +
    legacyReviews.filter((review) => review.status === value).length;
  const accepts = (itemStatus: ReviewStatus, itemSource: string) =>
    (status === 'all' || status === itemStatus) &&
    (source === 'all' || source === itemSource);
  const current = reviews.filter((review) => accepts(review.status, 'torchick'));
  const legacy = legacyReviews.filter((review) => accepts(review.status, review.source));
  const afterSave = () => {
    setEditing(null);
    setCreating(false);
    setSaved(true);
  };
  return (
    <main className="mx-auto max-w-5xl px-4 pb-20 pt-6 text-[#1b1715]">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{labels.title}</h1>
          <p className="mt-1 text-sm text-[#8f8478]">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/b/${encodeURIComponent(slug)}#reviews`}
            className="inline-flex min-h-11 items-center rounded-lg border border-[#d6c8b4] px-4 text-sm"
          >
            {labels.publicPage}
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setSaved(false);
            }}
            className="min-h-11 rounded-lg bg-[#102039] px-4 text-sm font-semibold text-white"
          >
            {labels.add}
          </button>
        </div>
      </header>
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
        {(['PENDING', 'PUBLISHED', 'HIDDEN'] as const).map((value) => (
          <div
            key={value}
            className="rounded-xl border border-[#e7ddcd] bg-white p-3 text-center"
          >
            <strong className="block text-2xl">{counts(value)}</strong>
            <span className="text-xs sm:text-sm">{labels.statuses[value]}</span>
          </div>
        ))}
      </div>
      {saved ? (
        <p
          role="status"
          className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {labels.saved}
        </p>
      ) : null}
      {creating ? (
        <div className="mb-5">
          <ReviewEditor onSaved={afterSave} onCancel={() => setCreating(false)} />
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label={labels.title}>
          {(['all', 'PENDING', 'PUBLISHED', 'HIDDEN'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={`min-h-11 rounded-lg border px-3 text-sm ${status === value ? 'border-[#102039] bg-[#102039] text-white' : 'border-[#e7ddcd] bg-white'}`}
            >
              {value === 'all' ? labels.all : labels.statuses[value]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          {labels.source}
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="min-h-11 rounded-lg border border-[#e7ddcd] bg-white px-2"
          >
            <option value="all">{labels.allSources}</option>
            <option value="google">{labels.google}</option>
            <option value="torchick">{labels.platform}</option>
            <option value="unknown">{labels.unknown}</option>
          </select>
        </label>
      </div>
      <div className="space-y-4">
        {current.map((review) => (
          <article
            key={review.id}
            id={`review-${review.id}`}
            className="scroll-mt-24 rounded-xl border border-[#e7ddcd] bg-white p-4"
          >
            {editing === review.id ? (
              <ReviewEditor
                review={review}
                onSaved={afterSave}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-[#8f8478]">
                  <span>
                    {review.origin === 'OWNER' ? labels.ownerEntry : labels.customerEntry}
                  </span>
                  <span>{labels.statuses[review.status]}</span>
                </div>
                <ReviewCard
                  review={{
                    id: review.id,
                    name: review.name,
                    rating: review.rating,
                    quote: review.text,
                    source: 'torchick',
                    editedByBusiness:
                      review.origin === 'CUSTOMER' && review.text !== review.originalText,
                    originalQuote: review.originalText,
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setEditing(review.id);
                    setSaved(false);
                  }}
                  className="mt-3 min-h-11 rounded-lg border border-[#d6c8b4] px-4 text-sm font-semibold"
                >
                  {labels.edit}
                </button>
              </>
            )}
          </article>
        ))}
        {legacy.map((review, index) => (
          <article
            key={`legacy-${index}`}
            className="rounded-xl border border-[#e7ddcd] bg-white p-4"
          >
            <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-[#8f8478]">
              <span>{labels.existingEntry}</span>
              <span>{labels.statuses[review.status]}</span>
            </div>
            <ReviewCard review={review} />
          </article>
        ))}
        {current.length + legacy.length === 0 ? (
          <p className="rounded-xl border border-[#e7ddcd] bg-white p-6 text-center">
            {labels.empty}
          </p>
        ) : null}
      </div>
      <p className="mt-5 text-xs leading-relaxed text-[#8f8478]">{labels.legacyHint}</p>
    </main>
  );
}
