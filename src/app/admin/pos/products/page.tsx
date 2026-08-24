import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listProducts, getProductById } from '@/server/repos/products';
import { formatAgorot, agorotToShekels } from '@/lib/money';
import ProductForm, { type ProductFormValues } from './ProductForm';
import { toggleProductActiveAction } from './actions';
import { MascotEmptyState } from '@/components/brand/MascotEmptyState';

export const metadata: Metadata = { title: t.admin.pos.products.title };

type Props = {
  searchParams: Promise<{ q?: string; filter?: string; edit?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const q = sp.q?.trim() ?? '';
  const activeOnly = sp.filter === 'active';
  const products = await listProducts(business.id, { q: q || undefined, activeOnly });

  let editing: ProductFormValues | undefined;
  if (sp.edit) {
    const p = await getProductById(business.id, sp.edit);
    if (p) {
      editing = {
        id: p.id,
        name: p.name,
        sku: p.sku ?? '',
        price: String(agorotToShekels(p.priceAgorot)),
        category: p.category ?? '',
        active: p.active,
      };
    }
  }

  const isSearching = q.length > 0;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <div className="mb-2">
        <Link href="/admin/pos" className="text-sm text-brand-700 hover:underline">
          ← {t.admin.pos.products.backToPos}
        </Link>
      </div>

      <header className="mb-6">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">
          {t.admin.pos.products.title} · {business.name}
        </h1>
      </header>

      {/* חיפוש וסינון */}
      <form method="get" className="mb-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label={t.admin.pos.products.searchLabel}
          placeholder={t.admin.pos.products.searchPlaceholder}
          className="w-full rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        {activeOnly ? <input type="hidden" name="filter" value="active" /> : null}
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {t.admin.pos.products.searchSubmit}
        </button>
      </form>

      <div className="mb-6 flex gap-2">
        <Link
          href={q ? `/admin/pos/products?q=${encodeURIComponent(q)}` : '/admin/pos/products'}
          className={`rounded-full px-3 py-1 text-sm ${
            !activeOnly ? 'bg-brand-600 text-white' : 'border border-[#d6c8b4] text-[#6e655f]'
          }`}
        >
          {t.admin.pos.products.filterAll}
        </Link>
        <Link
          href={
            q
              ? `/admin/pos/products?filter=active&q=${encodeURIComponent(q)}`
              : '/admin/pos/products?filter=active'
          }
          className={`rounded-full px-3 py-1 text-sm ${
            activeOnly ? 'bg-brand-600 text-white' : 'border border-[#d6c8b4] text-[#6e655f]'
          }`}
        >
          {t.admin.pos.products.filterActive}
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#1b1715]">
          {t.admin.pos.products.listTitle}
        </h2>
        {products.length === 0 ? (
          isSearching ? (
            <p className="rounded-xl border border-dashed border-[#d6c8b4] bg-white p-6 text-center text-sm text-[#8f8478]">
              {t.admin.pos.products.emptySearch}
            </p>
          ) : (
            <MascotEmptyState
              title={t.brand.empty.products.title}
              body={t.brand.empty.products.hint}
            />
          )
        ) : (
          <ul className="space-y-3">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-[#1b1715]">{p.name}</p>
                    {!p.active ? (
                      <span className="rounded-full bg-[#e7ddcd] px-2 py-0.5 text-xs text-[#6e655f]">
                        {t.admin.pos.products.inactiveBadge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-[#8f8478]">
                    {formatAgorot(p.priceAgorot)}
                    {p.sku ? ` · ${p.sku}` : ''}
                    {p.category ? ` · ${p.category}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/admin/pos/products?edit=${p.id}`}
                    className="rounded-lg border border-[#d6c8b4] px-3 py-1.5 text-sm text-[#4a4038] hover:bg-[#f7f2ea]"
                  >
                    {t.common.edit}
                  </Link>
                  <form action={toggleProductActiveAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={p.active ? '0' : '1'} />
                    <button
                      type="submit"
                      className="rounded-lg border border-[#d6c8b4] px-3 py-1.5 text-sm text-[#4a4038] hover:bg-[#f7f2ea]"
                    >
                      {p.active ? t.admin.pos.products.deactivate : t.admin.pos.products.activate}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProductForm initial={editing} />
    </main>
  );
}
