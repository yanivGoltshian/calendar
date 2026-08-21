import { CheckIcon } from './icons';
import SectionHeading from './SectionHeading';

type Benefit = { title: string; text?: string };
type Props = { title: string; benefits: Benefit[]; eyebrow?: string };

// רצועת יתרונות — שלושה קלפים קצרים שמסבירים למה לבחור בעסק.
export default function LandingHighlights({ title, benefits, eyebrow }: Props) {
  if (benefits.length === 0) return null;
  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {benefits.map((b, i) => (
          <div
            key={i}
            className="rounded-3xl border border-[color:var(--biz-border)] bg-white p-7 text-center shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-elevated"
          >
            <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--biz-soft)] text-[color:var(--biz-strong)]">
              <CheckIcon className="h-6 w-6" />
            </span>
            <p className="font-display text-lg font-bold text-slate-900">{b.title}</p>
            {b.text ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.text}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
