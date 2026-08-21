import { formatMinutes } from '@/lib/time';
import { MapPinIcon, PhoneIcon, NavigationIcon } from './icons';
import SectionHeading from './SectionHeading';

type WorkingHour = { weekday: number; startMinute: number; endMinute: number };

type Props = {
  title: string;
  workingHours: WorkingHour[];
  weekdays: readonly string[];
  closedLabel: string;
  todayIdx: number;
  address?: string | null;
  phone?: string | null;
  directionsCta: string;
  callCta: string;
  eyebrow?: string;
};

// מקטע מיקום ושעות — טבלת שעות פעילות לצד כתובת, ניווט וטלפון.
export default function LandingLocation({
  title,
  workingHours,
  weekdays,
  closedLabel,
  todayIdx,
  address,
  phone,
  directionsCta,
  callCta,
  eyebrow,
}: Props) {
  const hasHours = workingHours.length > 0;
  if (!hasHours && !address && !phone) return null;

  const byDay = new Map<number, WorkingHour>();
  for (const wh of workingHours) byDay.set(wh.weekday, wh);

  const mapHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} icon={<MapPinIcon className="h-4 w-4" />} />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {hasHours ? (
          <ul className="overflow-hidden rounded-3xl border border-[color:var(--biz-border)] bg-white shadow-soft">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const wh = byDay.get(d);
              const isToday = d === todayIdx;
              return (
                <li
                  key={d}
                  className={`flex items-center justify-between px-5 py-3 text-sm ${d > 0 ? 'border-t border-slate-100' : ''} ${isToday ? 'bg-[var(--biz-soft)] font-semibold' : ''}`}
                >
                  <span className="text-slate-900">{weekdays[d]}</span>
                  {wh ? (
                    <span dir="ltr" className="tabular-nums text-slate-700">
                      {formatMinutes(wh.startMinute)}–{formatMinutes(wh.endMinute)}
                    </span>
                  ) : (
                    <span className="text-slate-400">{closedLabel}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        {address || phone ? (
          <div className="flex flex-col gap-4">
            {address ? (
              <div className="rounded-3xl border border-[color:var(--biz-border)] bg-white p-5 shadow-soft">
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--biz-strong)]" />
                  {address}
                </p>
                {mapHref ? (
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--biz-soft)] px-4 py-2.5 text-sm font-semibold text-[color:var(--biz-strong)] transition hover:bg-[var(--biz)] hover:text-[color:var(--biz-ink)]"
                  >
                    <NavigationIcon className="h-4 w-4" />
                    {directionsCta}
                  </a>
                ) : null}
              </div>
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-2 rounded-3xl border border-[color:var(--biz-border)] bg-white p-5 text-sm font-semibold text-slate-700 shadow-soft transition hover:border-[color:var(--biz)]"
              >
                <PhoneIcon className="h-4 w-4 shrink-0 text-[color:var(--biz-strong)]" />
                <span dir="ltr" className="tabular-nums">{phone}</span>
                <span className="ms-auto text-[color:var(--biz-strong)]">{callCta}</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
