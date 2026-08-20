import Link from 'next/link';
import { formatAgorot } from '@/lib/money';
import { formatDuration } from '@/lib/time';
import type { SectionIconKey } from '@/lib/publicPageStyle';
import { SectionIcon, ClockIcon, ArrowLeftIcon } from './icons';

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
};

// מקטע השירותים — קלפים עשירים; כל קלף מקשר ישירות לזרימת קביעת התור הקיימת.
export default function LandingServices({ title, services, bookHref, iconKey, bookLabel }: Props) {
  if (services.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900">
        <SectionIcon iconKey={iconKey} className="h-6 w-6 text-[color:var(--biz-strong)]" />
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <Link
            key={s.id}
            href={bookHref}
            className="group flex flex-col justify-between rounded-2xl border border-[color:var(--biz-border)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{s.name}</p>
              {s.description ? (
                <p className="mt-1 line-clamp-2 text-sm leading-snug text-slate-600">{s.description}</p>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                {!s.hideDuration ? (
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                    {formatDuration(s.durationMin)}
                  </span>
                ) : null}
                {!s.hidePrice ? (
                  <span className="font-bold text-[color:var(--biz-ink-strong)]">{formatAgorot(s.priceAgorot)}</span>
                ) : null}
              </div>
              <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--biz-soft)] px-3 py-1.5 text-sm font-semibold text-[color:var(--biz-strong)] transition group-hover:bg-[var(--biz)] group-hover:text-[color:var(--biz-ink)]">
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
