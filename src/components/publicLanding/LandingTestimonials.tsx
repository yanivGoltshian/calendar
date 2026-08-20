import { StarIcon } from './icons';

type Testimonial = { name?: string; quote: string };
type Props = { title: string; items: Testimonial[] };

// מקטע המלצות — ציטוטים של לקוחות מרוצים.
export default function LandingTestimonials({ title, items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-5 text-xl font-bold text-slate-900">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((tm, i) => (
          <figure key={i} className="rounded-2xl border border-[color:var(--biz-border)] bg-white p-5 shadow-sm">
            <div className="mb-2 flex gap-0.5 text-[color:var(--biz-strong)]" aria-hidden>
              {[0, 1, 2, 3, 4].map((n) => (
                <StarIcon key={n} className="h-4 w-4" />
              ))}
            </div>
            <blockquote className="text-sm leading-relaxed text-slate-700">{tm.quote}</blockquote>
            {tm.name ? (
              <figcaption className="mt-3 text-sm font-semibold text-[color:var(--biz-ink-strong)]">{tm.name}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}
