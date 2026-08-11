import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listPunchCards } from '@/server/repos/punchCards';
import { listClients } from '@/server/repos/clients';
import { listServices } from '@/server/repos/services';
import { displayPhone } from '@/lib/crypto';
import { formatAgorot } from '@/lib/money';
import type { PunchCardStatus } from '@prisma/client';
import PunchCardForm from './PunchCardForm';
import { punchAction, completeAction, cancelAction } from './actions';

export const metadata: Metadata = { title: t.admin.punchCardsModule.title };

type Props = {
  searchParams: Promise<{ status?: string }>;
};

const STATUS_STYLE: Record<PunchCardStatus, string> = {
  ACTIVE: 'bg-brand-100 text-brand-700',
  COMPLETED: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const FILTERS: (PunchCardStatus | 'all')[] = ['all', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

export default async function AdminPunchCardsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const p = t.admin.punchCardsModule;

  const status =
    sp.status === 'ACTIVE' ||
    sp.status === 'COMPLETED' ||
    sp.status === 'CANCELLED' ||
    sp.status === 'EXPIRED'
      ? (sp.status as PunchCardStatus)
      : undefined;

  const [cards, clients, services] = await Promise.all([
    listPunchCards(business.id, status),
    listClients(business.id),
    listServices(business.id),
  ]);

  const tabHref = (value: PunchCardStatus | 'all') =>
    value === 'all' ? '/admin/punch-cards' : `/admin/punch-cards?status=${value}`;

  const filterLabel = (value: PunchCardStatus | 'all') =>
    value === 'all' ? p.filterAll : p.statuses[value];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {p.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{p.subtitle}</p>
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

      <h2 className="mb-3 text-lg font-bold text-slate-900">{p.listTitle}</h2>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {p.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => {
            const remaining = card.totalPunches - card.usedPunches;
            return (
              <li
                key={card.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">
                      {card.title || card.service?.name || p.defaultTitle}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">{card.client.name}</p>
                    <p className="text-sm text-slate-400" dir="ltr">
                      {displayPhone(card.client.phone)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[card.status]}`}
                  >
                    {p.statuses[card.status]}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-600"
                      style={{
                        width: `${Math.min(100, (card.usedPunches / card.totalPunches) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-700" dir="ltr">
                    {card.usedPunches}/{card.totalPunches}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 text-sm text-slate-500">
                  <span>
                    {p.remaining}: {remaining}
                  </span>
                  {card.priceAgorot != null ? <span>{formatAgorot(card.priceAgorot)}</span> : null}
                </div>

                {card.status === 'ACTIVE' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={punchAction}>
                      <input type="hidden" name="id" value={card.id} />
                      <button
                        type="submit"
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                      >
                        {p.punchCta}
                      </button>
                    </form>
                    <form action={completeAction}>
                      <input type="hidden" name="id" value={card.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {p.completeCta}
                      </button>
                    </form>
                    <form action={cancelAction}>
                      <input type="hidden" name="id" value={card.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        {p.cancelCta}
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <PunchCardForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
      />
    </main>
  );
}
