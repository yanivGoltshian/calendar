import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { PaymentMethod } from '@prisma/client';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listSales, getRegisterSummary, type SaleFilter } from '@/server/repos/sales';
import { formatAgorot } from '@/lib/money';
import {
  DEFAULT_TZ,
  todayDateString,
  addDaysToDateString,
  localWallTimeToUtc,
  formatTime,
} from '@/lib/time';
import { createSaleAction } from './actions';

export const metadata: Metadata = { title: t.admin.pos.title };

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

const TABS: { value: SaleFilter; label: string }[] = [
  { value: 'open', label: t.admin.pos.tabs.open },
  { value: 'completed', label: t.admin.pos.tabs.completed },
  { value: 'all', label: t.admin.pos.tabs.all },
];

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: t.admin.pos.methodCash,
  CARD: t.admin.pos.methodCard,
  BIT: t.admin.pos.methodBit,
  BANK_TRANSFER: t.admin.pos.methodBankTransfer,
  OTHER: t.admin.pos.methodOther,
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: t.admin.pos.statusOpen,
  COMPLETED: t.admin.pos.statusCompleted,
  VOIDED: t.admin.pos.statusVoided,
  REFUNDED: t.admin.pos.statusRefunded,
};

const STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-700',
  VOIDED: 'bg-slate-200 text-slate-600',
  REFUNDED: 'bg-red-100 text-red-700',
};

export default async function AdminPosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const tab: SaleFilter =
    sp.tab === 'completed' || sp.tab === 'all' ? sp.tab : 'open';

  const tz = DEFAULT_TZ;
  const today = todayDateString(tz);
  const [y, m, d] = today.split('-').map(Number);
  const tomorrow = addDaysToDateString(today, 1);
  const [ty, tm, td] = tomorrow.split('-').map(Number);
  const startUtc = localWallTimeToUtc(y, m, d, 0, tz);
  const endUtc = localWallTimeToUtc(ty, tm, td, 0, tz);

  const [sales, register] = await Promise.all([
    listSales(business.id, tab),
    getRegisterSummary(business.id, startUtc, endUtc),
  ]);

  const emptyText =
    tab === 'open'
      ? t.admin.pos.emptyOpen
      : tab === 'completed'
        ? t.admin.pos.emptyCompleted
        : t.admin.pos.empty;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {t.admin.pos.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t.admin.pos.subtitle}</p>
      </header>

      {/* סיכום קופה של היום */}
      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-slate-900">
          {t.admin.pos.registerTitle}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.admin.pos.registerSalesCount}</p>
            <p className="text-xl font-bold text-slate-900">{register.salesCount}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.admin.pos.registerTotal}</p>
            <p className="text-xl font-bold text-slate-900">
              {formatAgorot(register.totalAgorot)}
            </p>
          </div>
        </div>
        {register.byMethod.length > 0 ? (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-slate-500">
              {t.admin.pos.registerByMethod}
            </p>
            <ul className="space-y-1">
              {register.byMethod.map((row) => (
                <li
                  key={row.method}
                  className="flex items-center justify-between text-sm text-slate-700"
                >
                  <span>
                    {METHOD_LABEL[row.method]}{' '}
                    <span className="text-slate-400">({row.count})</span>
                  </span>
                  <span className="font-medium">{formatAgorot(row.amountAgorot)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* פעולות עליונות */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <form action={createSaleAction}>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
          >
            {t.admin.pos.newSale}
          </button>
        </form>
        <Link
          href="/admin/pos/products"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          {t.admin.pos.tabs.products}
        </Link>
      </div>

      {/* לשוניות סטטוס */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((f) => {
          const active = f.value === tab;
          const href = f.value === 'open' ? '/admin/pos' : `/admin/pos?tab=${f.value}`;
          return (
            <Link
              key={f.value}
              href={href}
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

      {sales.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-3">
          {sales.map((s) => (
            <li key={s.id}>
              <Link
                href={`/admin/pos/${s.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                      {t.admin.pos.saleNumber} #{s.id.slice(-6)}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_CLASS[s.status] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {s.client ? s.client.name : t.admin.pos.noClient} ·{' '}
                      {s._count.items} {t.admin.pos.itemsCount} ·{' '}
                      {formatTime(s.createdAt, tz)}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="font-bold text-slate-900">
                      {formatAgorot(s.totalAgorot)}
                    </p>
                    {s._count.documents > 0 ? (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {s._count.documents} {t.admin.pos.issuedDocuments}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
