import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listStaff } from '@/server/repos/staff';
import { getBusinessHours, getStaffHours } from '@/server/repos/workingHours';
import { formatMinutes } from '@/lib/time';
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
    </main>
  );
}
