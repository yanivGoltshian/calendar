import { UsersIcon, SparkleIcon, CalendarIcon } from './icons';
import SectionHeading from './SectionHeading';

type Benefit = { title: string; text?: string };
type Props = { title: string; benefits: Benefit[]; eyebrow?: string };

// אייקוני SVG פרימיום ייחודיים לכל קלף יתרון, לפי אינדקס, בסגנון האתר.
const HL_ICONS = [UsersIcon, SparkleIcon, CalendarIcon];

// רצועת יתרונות — שלושה קלפים קצרים שמסבירים למה לבחור בעסק.
export default function LandingHighlights({ title, benefits, eyebrow }: Props) {
  if (benefits.length === 0) return null;
  return (
    <section data-palette-surface="highlights" className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {benefits.map((b, i) => {
          const Icon = HL_ICONS[i % HL_ICONS.length];
          return (
            <div
              key={i}
              className="rounded-3xl border border-[color:var(--biz-border)] bg-[color:var(--c-surface,#ffffff)] p-7 text-center shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-elevated"
            >
              <span
                aria-hidden
                className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-[color:var(--biz-text,#3a3226)]"
                style={{ background: 'linear-gradient(160deg, var(--c-gold-soft), var(--c-brand-soft))' }}
              >
                <Icon className="h-7 w-7" />
              </span>
              <p className="font-display text-lg font-bold text-[color:var(--c-ink,#0f172a)]">{b.title}</p>
              {b.text ? <p className="mt-2 text-sm leading-relaxed text-[color:var(--c-muted,#475569)]">{b.text}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
