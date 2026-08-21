import { StarIcon } from './icons';
import SectionHeading from './SectionHeading';

type Testimonial = { name?: string; quote: string };
type Props = { title: string; items: Testimonial[]; eyebrow?: string };

// מקטע המלצות — ציטוטים של לקוחות מרוצים.
export default function LandingTestimonials({ title, items, eyebrow }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {items.map((tm, i) => (
          <figure key={i} className="rounded-3xl border border-[color:var(--biz-border)] bg-white p-7 shadow-soft">
            <div className="mb-3 flex gap-0.5 text-[color:var(--biz-strong)]" aria-hidden>
              {[0, 1, 2, 3, 4].map((n) => (
                <StarIcon key={n} className="h-4 w-4" />
              ))}
            </div>
            <blockquote className="font-display text-base leading-relaxed text-slate-700">{tm.quote}</blockquote>
            {tm.name ? (
              <figcaption className="mt-4 text-sm font-semibold text-[color:var(--biz-ink-strong)]">{tm.name}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
