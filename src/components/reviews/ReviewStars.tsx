import { t } from '@/i18n';
import { normalizeTestimonialRating } from '@/lib/publicPageStyle';

export default function ReviewStars({ rating }: { rating?: number }) {
  const value = normalizeTestimonialRating(rating);
  return (
    <span
      role="img"
      aria-label={
        value === undefined
          ? t.reviews.missingRating
          : t.reviews.ratingAria.replace('{rating}', String(value))
      }
      className="inline-block text-sm leading-5 tracking-wider text-accent-600"
    >
      <span aria-hidden="true">
        {'★'.repeat(value ?? 0)}
        <span className="opacity-30">{'☆'.repeat(5 - (value ?? 0))}</span>
      </span>
    </span>
  );
}
