import { PlusIcon } from './icons';
import SectionHeading from './SectionHeading';

type FaqItem = { question: string; answer: string };
type Props = { title: string; items: FaqItem[]; eyebrow?: string };

// מקטע שאלות ותשובות — אקורדיון נגיש מבוסס details/summary (ללא JS).
export default function LandingFaq({ title, items, eyebrow }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mx-auto mt-10 max-w-2xl space-y-3">
        {items.map((item, i) => (
          <details
            key={i}
            className="group rounded-3xl border border-[color:var(--biz-border)] bg-white px-6 py-5 shadow-soft [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display text-base font-bold text-slate-900">
              {item.question}
              <PlusIcon className="h-5 w-5 shrink-0 text-[color:var(--biz-strong)] transition group-open:rotate-45" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
