import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listStaff } from '@/server/repos/staff';
import { getBusinessHours, getStaffHours } from '@/server/repos/workingHours';
import { formatMinutes, formatDateString, formatTime, todayDateString } from '@/lib/time';
import { getHoursExceptionConflicts, listHoursExceptions } from '@/server/repos/workingHoursExceptions';
import ExceptionsForm, { DeleteExceptionButton } from './ExceptionsForm';
import { HEBREW_MONTHS, toHebrewDate } from '@/lib/workingHoursExceptions';
import WorkingHoursForm, { type DayRow } from './WorkingHoursForm';

export const metadata: Metadata = { title: t.admin.workingHours.title };

type Props = {
  searchParams: Promise<{ staff?: string }>;
};

type HoursRecord = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  breaks: unknown;
};

function exceptionDateLabel(date: string, calendar: string, annualMonth?: string | null): string {
  if (calendar !== 'HEBREW') return date;
  const hebrew = toHebrewDate(date);
  const month = HEBREW_MONTHS.find((value) => value === annualMonth) ?? hebrew.month;
  return `${hebrew.day} ${t.admin.hoursExceptions.months[month]} ${hebrew.year} (${date})`;
}

/** בניית שבעה ימי טופס מתוך רשומות שעות העבודה שנשמרו. */
function buildRows(records: HoursRecord[]): DayRow[] {
  const byDay = new Map<number, HoursRecord>();
  for (const r of records) {
    if (!byDay.has(r.weekday)) byDay.set(r.weekday, r);
  }

  const rows: DayRow[] = [];
  for (let d = 0; d < 7; d++) {
    const rec = byDay.get(d);
    if (rec) {
      const firstBreak =
        Array.isArray(rec.breaks) && Array.isArray(rec.breaks[0])
          ? (rec.breaks[0] as [number, number])
          : null;
      rows.push({
        weekday: d,
        open: true,
        start: formatMinutes(rec.startMinute),
        end: formatMinutes(rec.endMinute),
        breakStart: firstBreak ? formatMinutes(firstBreak[0]) : '',
        breakEnd: firstBreak ? formatMinutes(firstBreak[1]) : '',
      });
    } else {
      rows.push({
        weekday: d,
        open: false,
        start: '09:00',
        end: '17:00',
        breakStart: '',
        breakEnd: '',
      });
    }
  }
  return rows;
}

export default async function AdminWorkingHoursPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const staff = await listStaff(business.id);

  // ברירת המחדל היא שעות העסק; פרמטר ?staff=<id> עובר לשעות איש צוות.
  const selectedStaff = sp.staff
    ? staff.find((s) => s.id === sp.staff) ?? null
    : null;
  const scope: 'BUSINESS' | 'STAFF' = selectedStaff ? 'STAFF' : 'BUSINESS';

  const records = selectedStaff
    ? await getStaffHours(selectedStaff.id)
    : await getBusinessHours(business.id);

  const rows = buildRows(records as HoursRecord[]);
  const [exceptions, conflictInfo] = await Promise.all([
    listHoursExceptions(business.id), getHoursExceptionConflicts(business.id),
  ]);
  const exceptionText = t.admin.hoursExceptions;

  const chipBase =
    'rounded-full px-3 py-1.5 text-sm font-medium transition border';
  const chipActive = 'border-brand-600 bg-brand-50 text-brand-700';
  const chipIdle = 'border-[#e7ddcd] bg-white text-[#6e655f] hover:bg-[#f7f2ea]';

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">
          {t.admin.workingHours.title} · {business.name}
        </h1>
      </header>

      {/* בורר טווח: כל העסק או איש צוות ספציפי */}
      <section>
        <p className="mb-2 text-sm font-medium text-[#4a4038]">
          {t.admin.workingHours.scopeLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/working-hours"
            className={`${chipBase} ${scope === 'BUSINESS' ? chipActive : chipIdle}`}
          >
            {t.admin.workingHours.businessScopeName}
          </Link>
          {staff.map((s) => (
            <Link
              key={s.id}
              href={`/admin/working-hours?staff=${s.id}`}
              className={`${chipBase} ${
                selectedStaff?.id === s.id ? chipActive : chipIdle
              }`}
            >
              {s.displayName}
            </Link>
          ))}
        </div>
        {staff.length === 0 ? (
          <p className="mt-2 text-xs text-[#8f8478]">
            {t.admin.workingHours.staffEmpty}
          </p>
        ) : null}
      </section>

      <WorkingHoursForm
        key={selectedStaff?.id ?? 'business'}
        scope={scope}
        staffId={selectedStaff?.id}
        rows={rows}
      />
      <section className="mt-10 space-y-4" aria-labelledby="hours-exceptions-title">
        <h2 id="hours-exceptions-title" className="text-xl font-bold">{exceptionText.title}</h2>
        <p className="text-sm">{exceptionText.intro}</p>
        <p className="text-xs" dir="ltr">{business.timezone}</p>
        {conflictInfo.conflicts.length > 0 && <aside role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold">{exceptionText.conflicts}</h3>
          <p className="text-sm">{exceptionText.conflictsHelp}</p>
          <ul className="mt-2 space-y-1">
            {conflictInfo.conflicts.map((appointment) => <li key={appointment.id} className="text-sm">
              {appointment.staff.displayName} · {formatDateString(appointment.startAt, business.timezone)} · {formatTime(appointment.startAt, business.timezone)}{' '}
              <Link className="underline" href={`/admin?date=${formatDateString(appointment.startAt, business.timezone)}`}>{exceptionText.calendarLink}</Link>
            </li>)}
          </ul>
        </aside>}
        {conflictInfo.truncated && <p role="status" className="text-sm text-amber-800">{exceptionText.truncated}</p>}
        <ul className="space-y-3">
          {exceptions.map((rule) => <li key={rule.id} className="space-y-2 rounded-xl border bg-white p-4">
            <p className="font-semibold">{rule.title} · {rule.staffId
              ? staff.find((member) => member.id === rule.staffId)?.displayName ?? t.admin.workingHours.errorNoStaff
              : t.admin.workingHours.businessScopeName}</p>
            <p className="text-sm">
              {exceptionDateLabel(rule.startDate, rule.calendar, rule.annualMonth)}
              {rule.endDate !== rule.startDate ? ` / ${exceptionDateLabel(rule.endDate, rule.calendar)}` : ''} ·{' '}
              {rule.recurrence === 'ONCE' ? exceptionText.once : rule.recurrence === 'WEEKLY'
                ? `${exceptionText.weekly}: ${rule.intervalWeeks}` : `${exceptionText.annual} (${rule.calendar === 'HEBREW' ? exceptionText.hebrew : exceptionText.gregorian})`}
              {rule.until ? ` · ${rule.until}` : ''}
            </p>
            <p className="text-sm">{rule.closed ? exceptionText.closed : `${formatMinutes(rule.startMinute!)} / ${formatMinutes(rule.endMinute!)}`}</p>
            <DeleteExceptionButton id={rule.id} title={rule.title} />
          </li>)}
        </ul>
        {exceptions.length === 0 && <p className="text-sm">{exceptionText.empty}</p>}
        <ExceptionsForm key={selectedStaff?.id ?? 'business'} staff={staff}
          selectedStaffId={selectedStaff?.id} today={todayDateString(business.timezone)} />
      </section>
    </main>
  );
}
