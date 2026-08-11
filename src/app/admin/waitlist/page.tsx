import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getFirstBusiness } from '@/server/repos/business';
import { listWaitlist } from '@/server/repos/waitlist';
import { listServices } from '@/server/repos/services';
import { listStaff } from '@/server/repos/staff';
import { displayPhone } from '@/lib/crypto';
import { formatLongDate } from '@/lib/time';
import type { WaitlistStatus } from '@prisma/client';
import WaitlistForm from './WaitlistForm';
import { notifyAction, promoteAction, cancelAction } from './actions';

export const metadata: Metadata = { title: t.admin.waitlistModule.title };

type Props = {
  searchParams: Promise<{ status?: string }>;
};

const STATUS_STYLE: Record<WaitlistStatus, string> = {
  WAITING: 'bg-brand-100 text-brand-700',
  NOTIFIED: 'bg-amber-100 text-amber-700',
  BOOKED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
  EXPIRED: 'bg-slate-100 text-slate-500',
};

const FILTERS: (WaitlistStatus | 'all')[] = ['all', 'WAITING', 'NOTIFIED', 'BOOKED'];

export default async function AdminWaitlistPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getFirstBusiness();
  if (!business) notFound();

  const w = t.admin.waitlistModule;

  const status =
    sp.status === 'WAITING' ||
    sp.status === 'NOTIFIED' ||
    sp.status === 'BOOKED' ||
    sp.status === 'CANCELLED' ||
    sp.status === 'EXPIRED'
      ? (sp.status as WaitlistStatus)
      : undefined;

  const [entries, services, staff] = await Promise.all([
    listWaitlist(business.id, status),
    listServices(business.id),
    listStaff(business.id),
  ]);

  const tabHref = (value: WaitlistStatus | 'all') =>
    value === 'all' ? '/admin/waitlist' : `/admin/waitlist?status=${value}`;

  const filterLabel = (value: WaitlistStatus | 'all') =>
    value === 'all' ? w.filterAll : w.statuses[value];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {w.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{w.subtitle}</p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (status ?? 'all') === f;
          return (
            <Link
              key={f}
              href={tabHref(f)}
              className={
                active
                  ? 'rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50'
              }
            >
              {filterLabel(f)}
            </Link>
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-bold text-slate-900">{w.listTitle}</h2>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {w.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{entry.name}</p>
                  <p className="text-sm text-slate-400" dir="ltr">
                    {displayPhone(entry.phone)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[entry.status]}`}
                >
                  {w.statuses[entry.status]}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                {entry.service ? (
                  <span>
                    {w.serviceLabel}: {entry.service.name}
                  </span>
                ) : null}
                {entry.staff ? (
                  <span>
                    {w.staffLabel}: {entry.staff.displayName}
                  </span>
                ) : null}
                {entry.desiredDate ? (
                  <span>
                    {w.desiredDateLabel}: {formatLongDate(entry.desiredDate)}
                  </span>
                ) : null}
              </div>

              {entry.note ? <p className="mt-2 text-sm text-slate-600">{entry.note}</p> : null}

              {entry.status === 'WAITING' || entry.status === 'NOTIFIED' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.status === 'WAITING' ? (
                    <form action={notifyAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                      >
                        {w.notifyCta}
                      </button>
                    </form>
                  ) : null}
                  <form action={promoteAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      {w.promoteCta}
                    </button>
                  </form>
                  <form action={cancelAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      {w.cancelCta}
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <WaitlistForm
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        staff={staff.map((s) => ({ id: s.id, name: s.displayName }))}
      />
    </main>
  );
}
