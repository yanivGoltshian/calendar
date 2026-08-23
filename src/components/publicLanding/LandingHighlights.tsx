import SectionHeading from './SectionHeading';

type Benefit = { title: string; text?: string };
type Props = { title: string; benefits: Benefit[]; eyebrow?: string };

// אימוג'ים ייחודיים לכל קלף יתרון — רפואי, אבחון, טכנולוגיה — כמו במוקאפ המאושר.
const HL_ICONS = ['🩺', '✨', '🔬'];

// רצועת יתרונות — שלושה קלפים קצרים שמסבירים למה לבחור בעסק.
export default function LandingHighlights({ title, benefits, eyebrow }: Props) {
  if (benefits.length === 0) return null;
  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {benefits.map((b, i) => (
          <div
            key={i}
            className="rounded-3xl border border-[color:var(--biz-border)] bg-white p-7 text-center shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-elevated"
          >
            <span
              aria-hidden
              className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{ background: 'linear-gradient(160deg, rgba(198,168,106,0.24), rgba(176,133,95,0.18))' }}
            >
              {HL_ICONS[i % HL_ICONS.length]}
            </span>
            <p className="font-display text-lg font-bold text-slate-900">{b.title}</p>
            {b.text ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.text}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
