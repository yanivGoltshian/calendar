import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getFirstBusiness } from '@/server/repos/business';
import {
  getBusinessAppointments,
  type BusinessAppointmentsOptions,
} from '@/server/repos/appointments';
import { formatDateString, formatLongDate, formatTime } from '@/lib/time';
import { formatAgorot } from '@/lib/money';
import { displayPhone } from '@/lib/crypto';
import { approveAppointmentAction, cancelAppointmentAction } from './actions';

export const metadata: Metadata = { title: t.admin.nav.appointments };

type Tab = 'pending' | 'upcoming' | 'all';

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

const m = t.admin.appointmentsModule;

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
      return 'bg-amber-100 text-amber-800';
    case 'DONE':
      return 'bg-slate-200 text-slate-700';
    case 'NO_SHOW':
      return 'bg-red-100 text-red-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function queryForTab(tab: Tab): BusinessAppointmentsOptions {
  const now = new Date();
  switch (tab) {
    case 'pending':
      return { statuses: ['PENDING'], order: 'asc' };
    case 'all':
      return { order: 'desc', take: 100 };
    case 'upcoming':
    default:
      return { statuses: ['PENDING', 'CONFIRMED'], fromUtc: now, order: 'asc' };
  }
}

export default async function AdminAppointmentsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab: Tab = sp.tab === 'pending' || sp.tab === 'all' ? sp.tab : 'upcoming';

  const business = await getFirstBusiness();
  if (!business) notFound();

  const tz = business.timezone;
  const appointments = await getBusinessAppointments(business.id, queryForTab(tab));

  // מספר הממתינים לאישור — מוצג כתג ליד הטאב.
  const pendingCount = await getBusinessAppointments(business.id, {
    statuses: ['PENDING'],
  }).then((list) => list.length);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: m.tabs.pending },
    { key: 'upcoming', label: m.tabs.upcoming },
    { key: 'all', label: m.tabs.all },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {m.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{m.subtitle}</p>
      </header>

      {/* טאבים */}
      <nav className="mb-5 flex flex-wrap gap-2" aria-label={m.title}>
        {tabs.map((item) => {
          const active = item.key === tab;
          const showCount = item.key === 'pending' && pendingCount > 0;
          return (
            <Link
              key={item.key}
              href={`/admin/appointments?tab=${item.key}`}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
              {showCount ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* רשימת תורים */}
      {appointments.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {m.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {appointments.map((appt) => {
            const dateStr = formatDateString(appt.startAt, tz);
            return (
              <li
                key={appt.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900">
                      {formatTime(appt.startAt, tz)}
                      <span className="mx-1 text-slate-400">–</span>
                      {formatTime(appt.endAt, tz)}
                    </p>
                    <p className="text-sm text-slate-500">{formatLongDate(dateStr, tz)}</p>
                    <p className="mt-1 font-medium text-slate-800">{appt.client.name}</p>
                    <p className="text-sm text-slate-500" dir="ltr">
                      {displayPhone(appt.client.phone)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="text-slate-400">{m.staff}: </span>
                      {appt.staff.displayName}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {appt.services.map((s) => s.nameSnapshot).join(' + ')}
                      {appt.totalPriceAgorot > 0 ? (
                        <span className="text-slate-400">
                          {' · '}
                          {formatAgorot(appt.totalPriceAgorot)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                      appt.status,
                    )}`}
                  >
                    {t.admin.statuses[appt.status]}
                  </span>
                </div>

                {/* פעולות */}
                {appt.status !== 'CANCELLED' && appt.status !== 'DONE' ? (
                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                    {appt.status === 'PENDING' ? (
                      <form action={approveAppointmentAction}>
                        <input type="hidden" name="appointmentId" value={appt.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700"
                        >
                          {m.approve}
                        </button>
                      </form>
                    ) : null}
                    <form action={cancelAppointmentAction}>
                      <input type="hidden" name="appointmentId" value={appt.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                      >
                        {m.cancel}
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
