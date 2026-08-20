import { PlusIcon } from './icons';

type FaqItem = { question: string; answer: string };
type Props = { title: string; items: FaqItem[] };

// מקטע שאלות ותשובות — אקורדיון נגיש מבוסס details/summary (ללא JS).
export default function LandingFaq({ title, items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-5 text-xl font-bold text-slate-900">{title}</h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <details
            key={i}
            className="group rounded-2xl border border-[color:var(--biz-border)] bg-white px-5 py-4 shadow-sm [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900">
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
