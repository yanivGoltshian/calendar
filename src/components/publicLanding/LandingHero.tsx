import Link from 'next/link';
import { ArrowLeftIcon } from './icons';

type Props = {
  eyebrow?: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  bookHref: string;
};

// מקטע ההירו של עמוד הנחיתה — מוצג בתוך הקאבר הממותג בראש העמוד.
// כותב על רקע צבע המותג, ולכן משתמש בלבן/שקיפויות ולא במשתני --biz הכהים.
export default function LandingHero({ eyebrow, headline, subtext, ctaLabel, bookHref }: Props) {
  return (
    <div className="mt-6 max-w-xl">
      {eyebrow ? (
        <span className="inline-flex items-center rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur">
          {eyebrow}
        </span>
      ) : null}
      <p className={`${eyebrow ? 'mt-3' : ''} text-2xl font-extrabold leading-snug sm:text-4xl`}>{headline}</p>
      <span className="mt-3 block h-1 w-16 rounded-full bg-white/70" aria-hidden />
      <p className="mt-3 text-sm leading-relaxed opacity-90 sm:text-base">{subtext}</p>
      <Link
        href={bookHref}
        className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-base font-bold text-[color:var(--biz-ink-strong)] shadow-lg transition hover:bg-white/90"
      >
        {ctaLabel}
        <ArrowLeftIcon className="h-4 w-4 transition group-hover:-translate-x-1" />
      </Link>
    </div>
  );
}
