import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { getStatsSummary } from '@/server/repos/stats';
import { formatAgorot } from '@/lib/money';
import {
  DEFAULT_TZ,
  todayDateString,
  addDaysToDateString,
  localWallTimeToUtc,
  formatLongDate,
  formatShortDate,
} from '@/lib/time';

export const metadata: Metadata = { title: t.admin.statsModule.title };

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** המרת מחרוזת "YYYY-MM-DD" לרגע UTC של תחילת היום המקומי. */
function dayStartUtc(dateStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return localWallTimeToUtc(y, mo, d, 0, DEFAULT_TZ);
}

const PRESETS = [7, 30, 90];

export default async function AdminStatsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const s = t.admin.statsModule;

  const today = todayDateString();
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : today;
  const from =
    sp.from && DATE_RE.test(sp.from) ? sp.from : addDaysToDateString(to, -29);

  // טווח סופי-פתוח: מתחילת היום ה"מ" ועד תחילת היום שאחרי היום ה"עד".
  const fromUtc = dayStartUtc(from);
  const toUtc = dayStartUtc(addDaysToDateString(to, 1));

  const summary = await getStatsSummary(business.id, fromUtc, toUtc);

  const presetHref = (days: number) => {
    const start = addDaysToDateString(today, -(days - 1));
    return `/admin/stats?from=${start}&to=${today}`;
  };
  const isPreset = (days: number) =>
    to === today && from === addDaysToDateString(today, -(days - 1));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">
          {s.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-[#8f8478]">{s.subtitle}</p>
      </header>

      {/* טווח תאריכים */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((days) => (
          <Link
            key={days}
            href={presetHref(days)}
            className={
              isPreset(days)
                ? 'rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-full border border-[#e7ddcd] px-3 py-1.5 text-sm font-medium text-[#6e655f] transition hover:bg-[#f7f2ea]'
            }
          >
            {s.presetDays.replace('{n}', String(days))}
          </Link>
        ))}
      </div>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">{s.fromLabel}</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            dir="ltr"
            lang="he-IL"
            className="rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">{s.toLabel}</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            dir="ltr"
            lang="he-IL"
            className="rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
        >
          {s.apply}
        </button>
      </form>

      <p className="mb-5 text-sm text-[#8f8478]">
        {formatLongDate(from)} · {formatLongDate(to)}{' '}
        <span dir="ltr">({formatShortDate(from)} · {formatShortDate(to)})</span>
      </p>

      {/* מדדי מפתח */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#8f8478]">{s.totalAppointments}</p>
          <p className="mt-1 text-2xl font-bold text-[#1b1715]">{summary.totalAppointments}</p>
        </div>
        <div className="rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#8f8478]">{s.revenue}</p>
          <p className="mt-1 text-2xl font-bold text-[#1b1715]">
            {formatAgorot(summary.revenueAgorot)}
          </p>
          <p className="mt-0.5 text-xs text-[#b3a690]">{s.revenueHint}</p>
        </div>
        <div className="rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm">
          <p className="text-sm text-[#8f8478]">{s.newClients}</p>
          <p className="mt-1 text-2xl font-bold text-[#1b1715]">{summary.newClients}</p>
        </div>
      </div>

      {/* פילוח לפי סטטוס */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold text-[#1b1715]">{s.byStatusTitle}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {summary.byStatus.map((row) => (
            <div
              key={row.status}
              className="rounded-lg border border-[#e7ddcd] bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-sm text-[#8f8478]">{t.admin.statuses[row.status]}</p>
              <p className="mt-1 text-xl font-bold text-[#1b1715]">{row.count}</p>
            </div>
          ))}
        </div>
      </section>

      {/* שירותים מובילים */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-bold text-[#1b1715]">{s.topServicesTitle}</h2>
        {summary.topServices.length === 0 ? (
          <p className="rounded-xl border border-[#e7ddcd] bg-white p-6 text-center text-[#8f8478]">
            {s.empty}
          </p>
        ) : (
          <ul className="space-y-2">
            {summary.topServices.map((svc) => (
              <li
                key={svc.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#e7ddcd] bg-white px-4 py-2.5 shadow-sm"
              >
                <span className="min-w-0 truncate font-medium text-[#2a2320]">{svc.name}</span>
                <span className="shrink-0 text-sm text-[#8f8478]">
                  {svc.count} · {formatAgorot(svc.revenueAgorot)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* פילוח לפי צוות */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-[#1b1715]">{s.byStaffTitle}</h2>
        {summary.byStaff.length === 0 ? (
          <p className="rounded-xl border border-[#e7ddcd] bg-white p-6 text-center text-[#8f8478]">
            {s.empty}
          </p>
        ) : (
          <ul className="space-y-2">
            {summary.byStaff.map((row) => (
              <li
                key={row.name}
                className="flex items-center justify-between gap-3 rounded-lg border border-[#e7ddcd] bg-white px-4 py-2.5 shadow-sm"
              >
                <span className="min-w-0 truncate font-medium text-[#2a2320]">{row.name}</span>
                <span className="shrink-0 text-sm text-[#8f8478]">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
