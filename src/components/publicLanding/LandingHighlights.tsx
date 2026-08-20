import { CheckIcon } from './icons';

type Benefit = { title: string; text?: string };
type Props = { title: string; benefits: Benefit[] };

// רצועת יתרונות — שלושה קלפים קצרים שמסבירים למה לבחור בעסק.
export default function LandingHighlights({ title, benefits }: Props) {
  if (benefits.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="sr-only">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {benefits.map((b, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[color:var(--biz-border)] bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--biz-soft)] text-[color:var(--biz-strong)]">
              <CheckIcon className="h-5 w-5" />
            </span>
            <p className="font-semibold text-slate-900">{b.title}</p>
            {b.text ? <p className="mt-1 text-sm leading-snug text-slate-600">{b.text}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
