import { t } from '@/i18n';
import ReviewStars from './ReviewStars';
import ReviewSourceBadge, { type ReviewDisplaySource } from './ReviewSourceBadge';

export type ReviewCardContent = {
  id?: string;
  name?: string;
  rating?: number;
  quote: string;
  source: ReviewDisplaySource;
  editedByBusiness?: boolean;
  originalQuote?: string;
};

export default function ReviewCard({ review }: { review: ReviewCardContent }) {
  return (
    <figure
      data-review-id={review.id}
      className="m-0 flex min-w-0 flex-col rounded-lg border border-[color:var(--c-border,#e2e8f0)] bg-[color:var(--c-surface,#ffffff)] p-4"
    >
      <p className="mb-2">
        <ReviewStars rating={review.rating} />
      </p>
      {review.quote.trim() ? (
        <blockquote className="whitespace-pre-line break-words text-sm leading-relaxed text-[color:var(--c-ink,#463f3a)]">
          {review.quote}
        </blockquote>
      ) : null}
      {review.editedByBusiness ? (
        <div className="mt-2 text-xs leading-relaxed text-[color:var(--c-muted,#665d57)]">
          <p>{t.reviews.edited}</p>
          <details className="mt-1">
            <summary className="min-h-8 cursor-pointer py-1 underline underline-offset-4">
              {t.reviews.original}
            </summary>
            <p className="whitespace-pre-line break-words py-2">
              {review.originalQuote || t.reviews.ratingOnly}
            </p>
          </details>
        </div>
      ) : null}
      <figcaption className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-3 text-xs leading-5">
        {review.name ? (
          <bdi className="min-w-0 break-words font-bold leading-5 text-[color:var(--c-ink,#1b1715)]">
            {review.name}
          </bdi>
        ) : null}
        <ReviewSourceBadge source={review.source} />
      </figcaption>
    </figure>
  );
}
