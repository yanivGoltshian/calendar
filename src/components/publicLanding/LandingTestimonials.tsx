import { t } from '@/i18n';
import Link from 'next/link';
import ReviewCard, { type ReviewCardContent } from '@/components/reviews/ReviewCard';
import type { PublicBusinessReview } from '@/lib/businessReviews';
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
};

export default function LandingTestimonials({
  title,
  items,
  googleReviewsUrl,
  googleLabel,
  googleCta,
  googleEmptyText,
  platformReviews = [],
  submitHref,
}: Props) {
  const visible: ReviewCardContent[] = [
    ...visibleLandingTestimonials(items).map(review => ({
      name: review.name, quote: review.quote, rating: review.rating,
      source: review.source?.provider === 'google' ? 'google' as const : 'unknown' as const,
    })),
    ...platformReviews.map(review => ({ ...review, source: 'torchick' as const })),
  ];
  if (visible.length === 0 && !googleReviewsUrl && !submitHref) return null;

  return (
    <section id="reviews" className="mx-auto mt-12 max-w-4xl sm:mt-16">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold text-[color:var(--c-ink,#1b1715)] sm:text-lg">
          {visible.length || submitHref ? title : googleLabel ?? title}
        </h2>
        {submitHref ? (
          <Link href={submitHref} className="inline-flex min-h-11 items-center rounded-lg border border-[color:var(--c-border,#e2e8f0)] px-3 text-xs font-semibold text-[color:var(--biz-text,#334155)]">
            {t.reviews.write}
          </Link>
        ) : null}
        {googleReviewsUrl && googleCta ? (
          <a
            href={googleReviewsUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-11 items-center rounded-sm text-xs font-semibold text-[color:var(--biz-text,#334155)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 sm:text-sm"
          >
            {googleCta}
          </a>
        ) : null}
      </div>
      {visible.length === 0 && googleReviewsUrl && googleEmptyText ? (
        <p className="text-sm leading-relaxed text-[color:var(--c-muted,#665d57)]">
          {googleEmptyText}
        </p>
      ) : null}
      {visible.length === 0 && submitHref && !googleReviewsUrl ? (
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
