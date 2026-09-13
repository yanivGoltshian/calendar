import { StarIcon } from './icons';
import SectionHeading from './SectionHeading';

type Testimonial = { name?: string; quote: string };
type Props = {
  title: string;
  items: Testimonial[];
  eyebrow?: string;
  // כשקיים קישור לעסק בגוגל — המקטע מוצג כביקורות גוגל (סמל, כותרת וקריאה לצפייה בכולן).
  googleReviewsUrl?: string;
  googleLabel?: string;
  googleCta?: string;
};

// סמל גוגל בארבעת הצבעים — לזיהוי מיידי של מקור הביקורות.
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#4285F4" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" opacity=".9" />
      <path fill="#FBBC05" d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" opacity=".9" />
      <path fill="#EA4335" d="M12.7 28.1 6.2 33C9.6 39.4 16.2 44 24 44V36c-5.2 0-9.6-3.3-11.3-7.9z" opacity=".9" />
    </svg>
  );
}

// A Google link does not verify the provenance or rating of owner-authored testimonials.
export default function LandingTestimonials({ title, items, eyebrow, googleReviewsUrl, googleLabel, googleCta }: Props) {
  if (items.length === 0 && !googleReviewsUrl) return null;
  const isGoogle = Boolean(googleReviewsUrl);
  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={items.length ? title : googleLabel ?? title} />
      {isGoogle ? (
        <div className="mx-auto mt-6 flex w-fit items-center gap-3 rounded-full border border-[color:var(--biz-border)] bg-[color:var(--c-surface,#ffffff)] px-5 py-2.5 shadow-soft">
          <GoogleGlyph className="h-5 w-5" />
          {googleLabel ? (
            <span className="text-sm font-semibold text-[color:var(--biz-text,#334155)]">{googleLabel}</span>
          ) : null}
        </div>
      ) : null}
      {items.length > 0 ? <div className="mt-10 grid gap-5 min-[821px]:grid-cols-3">
        {items.map((tm, i) => (
          <figure
            key={i}
            className="rounded-[20px] border border-[color:var(--biz-border)] bg-[color:var(--c-surface,#ffffff)] p-6"
            style={{ boxShadow: '0 18px 40px -30px var(--c-shadow, rgba(40,28,18,0.5))' }}
          >
            <div className="flex gap-0.5 text-[color:var(--c-gold-strong,#f5b301)]" style={{ letterSpacing: '2px' }} aria-hidden>
              {[0, 1, 2, 3, 4].map((n) => (
                <StarIcon key={n} className="h-4 w-4" />
              ))}
            </div>
            <blockquote className="mt-3 font-display text-[0.98rem] leading-relaxed text-[color:var(--c-ink,#463f3a)]">{tm.quote}</blockquote>
            {tm.name ? (
              <figcaption className="mt-4 flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full font-display text-base font-extrabold text-[color:var(--c-on-brand-action,#ffffff)]"
                  style={{ background: 'linear-gradient(160deg, var(--c-brand-action), var(--c-brand-action-strong))' }}
                >
                  {tm.name.trim().charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.95rem] font-extrabold text-[color:var(--biz-text,#334155)]">{tm.name}</span>
                </span>
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div> : null}
      {isGoogle && googleCta ? (
        <div className="mt-9 text-center">
          <a
            href={googleReviewsUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold shadow-soft transition hover:opacity-95"
            style={{
              background: 'linear-gradient(90deg, var(--c-brand-action), var(--c-brand-action-strong))',
              color: 'var(--c-on-brand-action)',
            }}
          >
            <GoogleGlyph className="h-4 w-4" />
            {googleCta}
          </a>
        </div>
      ) : null}
    </section>
  );
}
