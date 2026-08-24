import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { MascotEmptyState } from '@/components/brand/MascotEmptyState';
import { getActiveBusiness } from '@/server/repos/business';
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
      return 'bg-[#e7ddcd] text-[#4a4038]';
    case 'NO_SHOW':
      return 'bg-red-100 text-red-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-[#efe6d8] text-[#6e655f]';
  }
}

// גוון תג אישור הלקוח מהתזכורת (ירוק לאישור, אדום להודעת אי-הגעה).
function confirmationBadgeClass(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-green-50 text-green-700 ring-1 ring-green-200';
    case 'DECLINED':
      return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    default:
      return 'bg-[#efe6d8] text-[#6e655f]';
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

  const business = await getActiveBusiness();
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
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">
          {m.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-[#8f8478]">{m.subtitle}</p>
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
                  : 'bg-[#efe6d8] text-[#4a4038] hover:bg-[#e7ddcd]'
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
        <MascotEmptyState
          title={t.brand.empty.appointments.title}
          body={t.brand.empty.appointments.hint}
        />
      ) : (
        <ul className="space-y-3">
          {appointments.map((appt) => {
            const dateStr = formatDateString(appt.startAt, tz);
            return (
              <li
                key={appt.id}
                className="rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-[#1b1715]">
                      {formatTime(appt.startAt, tz)}
                      <span className="mx-1 text-[#b3a690]">–</span>
                      {formatTime(appt.endAt, tz)}
                    </p>
                    <p className="text-sm text-[#8f8478]">{formatLongDate(dateStr, tz)}</p>
                    <Link
                      href={`/admin/clients/${appt.client.id}`}
                      className="mt-1 block font-medium text-[#2a2320] hover:text-brand-700 hover:underline"
                    >
                      {appt.client.name}
                    </Link>
                    {appt.client.phone ? (
                      <p className="text-sm text-[#8f8478]" dir="ltr">
                        {displayPhone(appt.client.phone)}
                      </p>
                    ) : null}
                    {appt.client.email ? (
                      <p className="text-sm text-[#8f8478]" dir="ltr">
                        {appt.client.email}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-[#6e655f]">
                      <span className="text-[#b3a690]">{m.staff}: </span>
                      {appt.staff.displayName}
                    </p>
                    <p className="mt-0.5 text-sm text-[#6e655f]">
                      {appt.services.map((s) => s.nameSnapshot).join(' + ')}
                      {appt.totalPriceAgorot > 0 ? (
                        <span className="text-[#b3a690]">
                          {' · '}
                          {formatAgorot(appt.totalPriceAgorot)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
                        appt.status,
                      )}`}
                    >
                      {t.admin.statuses[appt.status]}
                    </span>
                    {/* אישור הלקוח מהתזכורת — מוצג רק כאשר הלקוח הגיב בפועל. */}
                    {appt.confirmationStatus === 'CONFIRMED' ||
                    appt.confirmationStatus === 'DECLINED' ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${confirmationBadgeClass(
                          appt.confirmationStatus,
                        )}`}
                      >
                        {t.admin.confirmationStatuses[appt.confirmationStatus]}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* פעולות */}
                {appt.status !== 'CANCELLED' && appt.status !== 'DONE' ? (
                  <div className="mt-3 flex gap-2 border-t border-[#efe6d8] pt-3">
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
