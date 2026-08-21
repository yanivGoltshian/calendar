import Link from 'next/link';
import { formatAgorot } from '@/lib/money';
import { formatDuration } from '@/lib/time';
import type { SectionIconKey } from '@/lib/publicPageStyle';
import { SectionIcon, ClockIcon, ArrowLeftIcon } from './icons';
import SectionHeading from './SectionHeading';

export type LandingService = {
  id: string;
  name: string;
  description?: string | null;
  durationMin: number;
  priceAgorot: number;
  hidePrice?: boolean;
  hideDuration?: boolean;
};

type Props = {
  title: string;
  services: LandingService[];
  bookHref: string;
  iconKey: SectionIconKey;
  bookLabel: string;
  eyebrow?: string;
  lede?: string;
};

// מקטע השירותים — קלפים אלגנטיים; כל קלף מקשר ישירות לזרימת קביעת התור הקיימת.
// עוגן lp-services מאפשר גלילה חלקה מכפתור המשני שבהירו.
export default function LandingServices({ title, services, bookHref, iconKey, bookLabel, eyebrow, lede }: Props) {
  if (services.length === 0) return null;
  return (
    <section id="lp-services" className="mt-16 scroll-mt-24 sm:mt-24">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        lede={lede}
        icon={<SectionIcon iconKey={iconKey} className="h-4 w-4" />}
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <Link
            key={s.id}
            href={`${bookHref}?service=${s.id}`}
            className="group flex flex-col justify-between rounded-3xl border border-[color:var(--biz-border)] bg-white p-6 shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-elevated"
          >
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-lg font-bold leading-snug text-slate-900">{s.name}</p>
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--biz-soft)] text-[color:var(--biz-strong)] transition group-hover:bg-[var(--biz)] group-hover:text-[color:var(--biz-ink)]">
                  <SectionIcon iconKey={iconKey} className="h-5 w-5" />
                </span>
              </div>
              {s.description ? (
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">{s.description}</p>
              ) : null}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                {!s.hideDuration ? (
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                    {formatDuration(s.durationMin)}
                  </span>
                ) : null}
                {!s.hidePrice ? (
                  <span className="font-display text-base font-bold text-[color:var(--biz-ink-strong)]">
                    {formatAgorot(s.priceAgorot)}
                  </span>
                ) : null}
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--biz-strong)]">
                {bookLabel}
                <ArrowLeftIcon className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
