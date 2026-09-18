import { t } from '@/i18n';
import ReviewSubmissionDialog from '@/components/reviews/ReviewSubmissionDialog';
import ReviewCard, { type ReviewCardContent } from '@/components/reviews/ReviewCard';
import type {
  PublicBusinessReview,
  ReviewSubmitAction,
} from '@/lib/businessReviews';
import {
  visibleLandingTestimonials,
  type LandingTestimonial,
} from '@/lib/publicPageStyle';

type Props = {
  title: string;
  items: (Omit<LandingTestimonial, 'name'> & { name?: string })[];
  googleReviewsUrl?: string;
  googleLabel?: string;
  googleCta?: string;
  googleEmptyText?: string;
  platformReviews?: PublicBusinessReview[];
  submitHref?: string;
  reviewSubmitAction?: ReviewSubmitAction;
};

export default function LandingTestimonials({
  title,
  items,
  googleLabel,
  platformReviews = [],
  submitHref,
  reviewSubmitAction,
}: Props) {
  const visible: ReviewCardContent[] = [
    ...visibleLandingTestimonials(items).map(review => ({
      name: review.name, quote: review.quote, rating: review.rating,
      source: review.source?.provider === 'google' ? 'google' as const : 'unknown' as const,
    })),
    ...platformReviews.map(review => ({ ...review, source: 'torchick' as const })),
  ];
  if (visible.length === 0 && !submitHref) return null;

  return (
    <section id="reviews" className="mx-auto mt-12 max-w-4xl sm:mt-16">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold text-[color:var(--c-ink,#1b1715)] sm:text-lg">
          {visible.length || submitHref ? title : googleLabel ?? title}
        </h2>
        {submitHref ? (
          <ReviewSubmissionDialog href={submitHref} action={reviewSubmitAction} />
        ) : null}
      </div>
      {visible.length === 0 && submitHref ? (
        <p className="text-sm text-[color:var(--c-muted,#665d57)]">{t.reviews.emptyPublic}</p>
      ) : null}
      {visible.length > 0 ? (
        <div className={`grid gap-3 sm:grid-cols-2 ${visible.length > 2 ? 'lg:grid-cols-3' : ''}`}>
          {visible.map((review, index) => <ReviewCard key={review.id ?? `legacy-${index}`} review={review} />)}
        </div>
      ) : null}
    </section>
  );
}
