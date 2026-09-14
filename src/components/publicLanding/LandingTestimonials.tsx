import { t } from '@/i18n';
import {
  normalizeTestimonialRating,
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
};

export default function LandingTestimonials({
  title,
  items,
  googleReviewsUrl,
  googleLabel,
  googleCta,
  googleEmptyText,
}: Props) {
  const visible = visibleLandingTestimonials(items);
  if (visible.length === 0 && !googleReviewsUrl) return null;
  const labels = t.publicPage.landing;

  return (
    <section className="mx-auto mt-12 max-w-4xl sm:mt-16">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-bold text-[color:var(--c-ink,#1b1715)] sm:text-lg">
          {visible.length ? title : googleLabel ?? title}
        </h2>
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
      {visible.length === 0 && googleEmptyText ? (
        <p className="text-sm leading-relaxed text-[color:var(--c-muted,#665d57)]">
          {googleEmptyText}
        </p>
      ) : null}
      {visible.length > 0 ? (
        <div className={`grid gap-3 sm:grid-cols-2 ${visible.length > 2 ? 'lg:grid-cols-3' : ''}`}>
          {visible.map((review, index) => {
            const rating = normalizeTestimonialRating(review.rating);
            const isGoogle = review.source?.provider === 'google';
            return (
              <figure
                key={index}
                className="m-0 flex min-w-0 flex-col rounded-lg border border-[color:var(--c-border,#e2e8f0)] bg-[color:var(--c-surface,#ffffff)] p-4"
              >
                {rating !== undefined ? (
                  <p
                    role="img"
                    aria-label={labels.testimonialRating.replace('{rating}', String(rating))}
                    className="mb-2 text-sm leading-none tracking-wider text-accent-600"
                  >
                    <span aria-hidden="true">{'★'.repeat(rating)}</span>
                  </p>
                ) : null}
                <blockquote className="whitespace-pre-line break-words text-sm leading-relaxed text-[color:var(--c-ink,#463f3a)]">
                  {review.quote}
                </blockquote>
                {review.name || isGoogle ? (
                  <figcaption className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-3 text-xs leading-relaxed">
                    {review.name ? (
                      <bdi className="min-w-0 break-words font-bold text-[color:var(--c-ink,#1b1715)]">
                        {review.name}
                      </bdi>
                    ) : null}
                    {isGoogle ? (
                      <span className="text-[color:var(--c-muted,#665d57)]">{labels.googleReviewSource}</span>
                    ) : null}
                  </figcaption>
                ) : null}
              </figure>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
