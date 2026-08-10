import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getFirstBusiness } from '@/server/repos/business';
import { listClients, type ClientFilter } from '@/server/repos/clients';
import { displayPhone } from '@/lib/crypto';
import ClientForm from './ClientForm';

export const metadata: Metadata = { title: t.admin.clients.title };

type Props = {
  searchParams: Promise<{ q?: string; filter?: string }>;
};

const FILTERS: { value: ClientFilter; label: string }[] = [
  { value: 'all', label: t.admin.clients.filterAll },
  { value: 'active', label: t.admin.clients.filterActive },
  { value: 'blocked', label: t.admin.clients.filterBlocked },
];

export default async function AdminClientsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getFirstBusiness();
  if (!business) notFound();

  const q = sp.q?.trim() ?? '';
  const filter: ClientFilter =
    sp.filter === 'active' || sp.filter === 'blocked' ? sp.filter : 'all';

  const clients = await listClients(business.id, { q, filter });
  const isSearching = q.length > 0 || filter !== 'all';

  const tabHref = (value: ClientFilter) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (value !== 'all') params.set('filter', value);
    const qs = params.toString();
    return qs ? `/admin/clients?${qs}` : '/admin/clients';
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {t.admin.clients.title} · {business.name}
        </h1>
      </header>

      {/* חיפוש */}
      <form method="get" className="mb-3 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label={t.admin.clients.searchLabel}
          placeholder={t.admin.clients.searchPlaceholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
        >
          {t.admin.clients.searchSubmit}
        </button>
      </form>

      {/* סינון לפי מצב */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <Link
              key={f.value}
              href={tabHref(f.value)}
              className={
                active
                  ? 'rounded-full bg-brand-600 px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50'
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-bold text-slate-900">
        {t.admin.clients.listTitle}
      </h2>

      {clients.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {isSearching ? t.admin.clients.emptySearch : t.admin.clients.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/clients/${c.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                      {c.name}
                      {c.blocked ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {t.admin.clients.blockedBadge}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500" dir="ltr">
                      {displayPhone(c.phone)}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm text-slate-400">
                    {c._count.appointments} {t.admin.clients.appointmentsCount}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* טופס הוספת לקוח */}
      <ClientForm />
    </main>
  );
}
