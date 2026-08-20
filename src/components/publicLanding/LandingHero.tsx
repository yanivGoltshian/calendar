import Link from 'next/link';
import { t } from '@/i18n';
import { ArrowLeftIcon } from './icons';

type Props = {
  eyebrow?: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  bookHref: string;
};

// מקטע ההירו של עמוד הנחיתה הפרימיום — מוצג בתוך הקאבר הממותג בראש העמוד.
// כותב על רקע צבע המותג, ולכן משתמש בלבן/שקיפויות ולא במשתני --biz הכהים.
// טיפוגרפיה גדולה בפונט התצוגה, קו גרדיאנט עדין ושתי קריאות לפעולה (תור + שירותים).
export default function LandingHero({ eyebrow, headline, subtext, ctaLabel, bookHref }: Props) {
  return (
    <div className="mt-8 max-w-2xl sm:mt-10">
      {eyebrow ? (
        <span className="inline-flex items-center rounded-full border border-white/40 bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] backdrop-blur">
          {eyebrow}
        </span>
      ) : null}
      <p
        className={`${eyebrow ? 'mt-4' : ''} font-display text-3xl font-bold leading-[1.12] tracking-tight sm:text-5xl`}
      >
        {headline}
      </p>
      <span className="mt-5 block h-0.5 w-20 rounded-full bg-white/70" aria-hidden />
      <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/90 sm:text-lg">{subtext}</p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link
          href={bookHref}
          className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-[color:var(--biz-ink-strong)] shadow-elevated transition hover:-translate-y-0.5 hover:bg-white/95"
        >
          {ctaLabel}
          <ArrowLeftIcon className="h-4 w-4 transition group-hover:-translate-x-1" />
        </Link>
        <a
          href="#lp-services"
          className="inline-flex items-center gap-2 rounded-full border border-white/50 px-7 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:border-white hover:bg-white/10"
        >
          {t.premiumLanding.heroSecondaryCta}
        </a>
      </div>
    </div>
  );
}
