import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getFirstBusiness } from '@/server/repos/business';
import {
  listStockLevels,
  getStockRow,
  listCategories,
  listOpenLowStockAlerts,
  listStockMovements,
  type StockRow,
} from '@/server/repos/inventory';
import StockForm, { type StockFormProduct } from './StockForm';

export const metadata: Metadata = { title: t.admin.inventory.title };

type Props = {
  searchParams: Promise<{ q?: string; category?: string; edit?: string }>;
};

const cardClass = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';
const emptyClass =
  'rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500';

/** בונה קישור לעמוד המלאי תוך שימור פרמטרי החיפוש/הסינון הקיימים. */
function buildHref(params: { q?: string; category?: string; edit?: string }): string {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.category) usp.set('category', params.category);
  if (params.edit) usp.set('edit', params.edit);
  const qs = usp.toString();
  return qs ? `/admin/inventory?${qs}` : '/admin/inventory';
}

export default async function InventoryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getFirstBusiness();
  if (!business) notFound();

  const q = sp.q?.trim() ?? '';
  const category = sp.category?.trim() ?? '';

  const [rows, categories, alerts] = await Promise.all([
    listStockLevels(business.id, { q: q || undefined, category: category || undefined }),
    listCategories(business.id),
    listOpenLowStockAlerts(business.id),
  ]);

  let editing: StockFormProduct | undefined;
  let movements: Awaited<ReturnType<typeof listStockMovements>> = [];
  if (sp.edit) {
    const row = await getStockRow(business.id, sp.edit);
    if (row) {
      editing = {
        id: row.productId,
        name: row.name,
        quantity: row.quantity,
        threshold: row.lowStockThreshold,
        tracked: row.tracked,
      };
      movements = await listStockMovements(business.id, { productId: row.productId, limit: 20 });
    }
  }

  const isSearching = q.length > 0 || category.length > 0;

  // קיבוץ לפי קטגוריה (השורות כבר ממוינות category→name בשכבת ה-repo).
  const groups = new Map<string, StockRow[]>();
  for (const row of rows) {
    const key = row.category ?? t.admin.inventory.uncategorized;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <div className="mb-2">
        <Link href="/admin/pos" className="text-sm text-brand-700 hover:underline">
          ← {t.admin.inventory.backToPos}
        </Link>
      </div>

      <header className="mb-6">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {t.admin.inventory.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{t.admin.inventory.subtitle}</p>
      </header>

      {/* התראות מלאי נמוך */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          {t.admin.inventory.lowStockTitle}
        </h2>
        {alerts.length === 0 ? (
          <p className={emptyClass}>{t.admin.inventory.lowStockEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{a.product.name}</p>
                  {a.product.category ? (
                    <p className="text-xs text-slate-500">{a.product.category}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {t.admin.inventory.lowStockBadge}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* חיפוש */}
      <form method="get" className="mb-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label={t.admin.inventory.searchLabel}
          placeholder={t.admin.inventory.searchPlaceholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {t.admin.inventory.searchSubmit}
        </button>
      </form>

      {/* סינון לפי קטגוריה */}
      {categories.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={buildHref({ q })}
            className={`rounded-full px-3 py-1 text-sm ${
              !category ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-600'
            }`}
          >
            {t.admin.inventory.filterAllCategories}
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={buildHref({ q, category: c })}
              className={`rounded-full px-3 py-1 text-sm ${
                category === c ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-600'
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      ) : null}

      {/* רשימת מוצרים ומלאי */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">{t.admin.inventory.listTitle}</h2>
        {rows.length === 0 ? (
          <p className={emptyClass}>
            {isSearching ? t.admin.inventory.emptySearch : t.admin.inventory.empty}
          </p>
        ) : (
          <div className="space-y-6">
            {[...groups.entries()].map(([groupLabel, groupRows]) => (
              <div key={groupLabel}>
                <h3 className="mb-2 text-sm font-semibold text-slate-500">{groupLabel}</h3>
                <ul className="space-y-3">
                  {groupRows.map((row) => (
                    <li
                      key={row.productId}
                      className={`flex items-center justify-between gap-3 ${cardClass}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-slate-900">{row.name}</p>
                          {row.isLow ? (
                            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                              {t.admin.inventory.lowStockBadge}
                            </span>
                          ) : null}
                          {!row.tracked ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                              {t.admin.inventory.untrackedBadge}
                            </span>
                          ) : null}
                          {!row.active ? (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                              {t.admin.inventory.inactiveBadge}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {t.admin.inventory.quantityLabel}:{' '}
                          <span className="font-medium text-slate-700">
                            {row.tracked ? row.quantity : t.admin.inventory.quantityUntracked}
                          </span>
                          {' · '}
                          {t.admin.inventory.thresholdLabel}:{' '}
                          <span className="font-medium text-slate-700">
                            {row.lowStockThreshold > 0
                              ? row.lowStockThreshold
                              : t.admin.inventory.thresholdNone}
                          </span>
                          {row.sku ? ` · ${row.sku}` : ''}
                        </p>
                      </div>
                      <Link
                        href={buildHref({ q, category, edit: row.productId })}
                        className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {t.admin.inventory.updateCta}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* טופס עדכון מלאי + תנועות אחרונות (במצב עריכה) */}
      {editing ? (
        <>
          <StockForm product={editing} />

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              {t.admin.inventory.movementsTitle}
            </h2>
            {movements.length === 0 ? (
              <p className={emptyClass}>{t.admin.inventory.movementsEmpty}</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">
                        {t.admin.inventory.movementQuantityHeader}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t.admin.inventory.movementTypeHeader}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t.admin.inventory.movementDateHeader}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t.admin.inventory.movementNoteHeader}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 font-medium text-slate-900" dir="ltr">
                          {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {t.admin.inventory.movementTypes[m.type]}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {new Date(m.createdAt).toLocaleDateString('he-IL')}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{m.note ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
