import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listWaitlist } from '@/server/repos/waitlist';
import { listServices } from '@/server/repos/services';
import { listStaff } from '@/server/repos/staff';
import { displayPhone } from '@/lib/crypto';
import { formatLongDate } from '@/lib/time';
import type { WaitlistStatus } from '@prisma/client';
import WaitlistForm from './WaitlistForm';
import { notifyAction, promoteAction, cancelAction } from './actions';
import { MascotEmptyState } from '@/components/brand/MascotEmptyState';

export const metadata: Metadata = { title: t.admin.waitlistModule.title };

type Props = {
  searchParams: Promise<{ status?: string }>;
};

const STATUS_STYLE: Record<WaitlistStatus, string> = {
  WAITING: 'bg-brand-100 text-brand-700',
  NOTIFIED: 'bg-amber-100 text-amber-700',
  BOOKED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-[#efe6d8] text-[#8f8478]',
  EXPIRED: 'bg-[#efe6d8] text-[#8f8478]',
};

const FILTERS: (WaitlistStatus | 'all')[] = ['all', 'WAITING', 'NOTIFIED', 'BOOKED'];

export default async function AdminWaitlistPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
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
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">
          {w.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-[#8f8478]">{w.subtitle}</p>
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
                  : 'rounded-full border border-[#e7ddcd] px-3 py-1.5 text-sm font-medium text-[#6e655f] transition hover:bg-[#f7f2ea]'
              }
            >
              {filterLabel(f)}
            </Link>
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-bold text-[#1b1715]">{w.listTitle}</h2>

      {entries.length === 0 ? (
        <MascotEmptyState
          title={t.brand.empty.waitlist.title}
          body={t.brand.empty.waitlist.hint}
        />
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1b1715]">{entry.name}</p>
                  <p className="text-sm text-[#b3a690]" dir="ltr">
                    {displayPhone(entry.phone)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[entry.status]}`}
                >
                  {w.statuses[entry.status]}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#8f8478]">
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

              {entry.note ? <p className="mt-2 text-sm text-[#6e655f]">{entry.note}</p> : null}

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
                      className="rounded-lg border border-[#d6c8b4] px-4 py-2 text-sm font-medium text-[#4a4038] transition hover:bg-[#f7f2ea]"
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
