import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getFirstBusiness } from '@/server/repos/business';
import { listStaff } from '@/server/repos/staff';
import { listServices } from '@/server/repos/services';
import { getAppointmentsForStaffRange } from '@/server/repos/appointments';
import {
  todayDateString,
  addDaysToDateString,
  formatLongDate,
  formatTime,
  localWallTimeToUtc,
} from '@/lib/time';
import { formatAgorot } from '@/lib/money';
import { displayPhone } from '@/lib/crypto';
import {
  confirmAttendanceAction,
  cancelAppointmentAction,
} from './actions';
import NewAppointmentForm from './NewAppointmentForm';

export const metadata: Metadata = { title: t.admin.calendarTitle };

type Props = {
  searchParams: Promise<{ date?: string; staffId?: string }>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export default async function AdminCalendarPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getFirstBusiness();
  if (!business) notFound();

  const staff = await listStaff(business.id);
  const services = await listServices(business.id);

  // ברירת מחדל: היום ואיש הצוות הראשון.
  const date = sp.date && DATE_RE.test(sp.date) ? sp.date : todayDateString(business.timezone);
  const activeStaff = staff.find((s) => s.id === sp.staffId) ?? staff[0] ?? null;

  const tz = business.timezone;
  const dayStart = localWallTimeToUtc(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)),
    Number(date.slice(8, 10)),
    0,
    tz,
  );
  const nextDate = addDaysToDateString(date, 1);
  const dayEnd = localWallTimeToUtc(
    Number(nextDate.slice(0, 4)),
    Number(nextDate.slice(5, 7)),
    Number(nextDate.slice(8, 10)),
    0,
    tz,
  );

  const appointments = activeStaff
    ? await getAppointmentsForStaffRange(activeStaff.id, dayStart, dayEnd)
    : [];

  const prevDate = addDaysToDateString(date, -1);
  const today = todayDateString(tz);

  const staffHref = (staffId: string) =>
    `/admin?date=${date}&staffId=${staffId}`;
  const dateHref = (d: string) =>
    `/admin?date=${d}${activeStaff ? `&staffId=${activeStaff.id}` : ''}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {t.admin.calendarTitle} · {business.name}
        </h1>
      </header>

      {/* בורר איש צוות */}
      {staff.length > 0 ? (
        <nav className="mb-4 flex flex-wrap gap-2" aria-label={t.admin.staffLabel}>
          {staff.map((s) => (
            <Link
              key={s.id}
              href={staffHref(s.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeStaff?.id === s.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {s.displayName}
              {s.title ? <span className="opacity-70"> · {s.title}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* ניווט תאריכים */}
      <div className="mb-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
        <Link
          href={dateHref(prevDate)}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          aria-label={t.admin.prevDay}
        >
          ‹ {t.admin.prevDay}
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900">{formatLongDate(date, tz)}</p>
          {date !== today ? (
            <Link href={dateHref(today)} className="text-xs text-brand-600 hover:underline">
              {t.admin.today}
            </Link>
          ) : (
            <span className="text-xs text-slate-400">{t.admin.today}</span>
          )}
        </div>
        <Link
          href={dateHref(nextDate)}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          aria-label={t.admin.nextDay}
        >
          {t.admin.nextDay} ›
        </Link>
      </div>

      {/* רשימת תורים */}
      {activeStaff == null ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {t.admin.noAppointments}
        </p>
      ) : appointments.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {t.admin.noAppointments}
        </p>
      ) : (
        <ul className="space-y-3">
          {appointments.map((appt) => (
            <li
              key={appt.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">
                    {formatTime(appt.startAt, tz)}
                    <span className="mx-1 text-slate-400">–</span>
                    {formatTime(appt.endAt, tz)}
                  </p>
                  <p className="mt-0.5 font-medium text-slate-800">{appt.client.name}</p>
                  <p className="text-sm text-slate-500" dir="ltr">
                    {displayPhone(appt.client.phone)}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
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
                  {t.admin.statuses[appt.status as keyof typeof t.admin.statuses]}
                </span>
              </div>

              {/* פעולות */}
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                {appt.status !== 'CONFIRMED' && appt.status !== 'CANCELLED' ? (
                  <form action={confirmAttendanceAction}>
                    <input type="hidden" name="appointmentId" value={appt.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700"
                    >
                      {t.admin.confirmAttendance}
                    </button>
                  </form>
                ) : null}
                {appt.status !== 'CANCELLED' ? (
                  <form action={cancelAppointmentAction}>
                    <input type="hidden" name="appointmentId" value={appt.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                    >
                      {t.admin.cancelAppointment}
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* יצירת תור ידנית */}
      {activeStaff && services.length > 0 ? (
        <NewAppointmentForm
          staffId={activeStaff.id}
          staffName={activeStaff.displayName}
          date={date}
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            durationMin: s.durationMin,
            priceAgorot: s.priceAgorot,
          }))}
        />
      ) : null}
    </main>
  );
}
