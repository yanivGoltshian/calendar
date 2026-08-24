import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { PaymentMethod, SaleStatus, DocumentType } from '@prisma/client';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { Mascot } from '@/components/brand/Mascot';
import { getActiveBusiness } from '@/server/repos/business';
import { getSaleWithDetails } from '@/server/repos/sales';
import { listActiveProducts } from '@/server/repos/products';
import { listServices } from '@/server/repos/services';
import { listStaff } from '@/server/repos/staff';
import { listClients } from '@/server/repos/clients';
import { getBusinessAppointments } from '@/server/repos/appointments';
import { formatAgorot, agorotToShekels } from '@/lib/money';
import { DEFAULT_TZ, formatDateString, formatTime } from '@/lib/time';
import { ConfirmSubmit } from '../ConfirmSubmit';
import {
  addProductItemAction,
  addServiceItemAction,
  addCustomItemAction,
  updateItemQuantityAction,
  removeItemAction,
  setDiscountAction,
  setSaleLinksAction,
  addPaymentAction,
  removePaymentAction,
  closeSaleAction,
  voidSaleAction,
  issueDocumentFromSaleAction,
} from '../actions';

type Props = {
  params: Promise<{ saleId: string }>;
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: t.admin.pos.methodCash,
  CARD: t.admin.pos.methodCard,
  BIT: t.admin.pos.methodBit,
  BANK_TRANSFER: t.admin.pos.methodBankTransfer,
  OTHER: t.admin.pos.methodOther,
};

const STATUS_LABEL: Record<SaleStatus, string> = {
  OPEN: t.admin.pos.statusOpen,
  COMPLETED: t.admin.pos.statusCompleted,
  VOIDED: t.admin.pos.statusVoided,
  REFUNDED: t.admin.pos.statusRefunded,
};

const STATUS_CLASS: Record<SaleStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-green-100 text-green-700',
  VOIDED: 'bg-[#e7ddcd] text-[#6e655f]',
  REFUNDED: 'bg-red-100 text-red-700',
};

const DOC_TYPE_LABEL: Record<string, string> = {
  RECEIPT: t.admin.documents.typeReceipt,
  TAX_INVOICE: t.admin.documents.typeTaxInvoice,
  INVOICE_RECEIPT: t.admin.documents.typeInvoiceReceipt,
  CREDIT_NOTE: t.admin.documents.typeCreditNote,
};

// סוגי המסמכים שניתן להפיק ישירות מעסקה (זיכוי מופק ממסך המסמכים).
const ISSUABLE_TYPES: DocumentType[] = ['RECEIPT', 'TAX_INVOICE', 'INVOICE_RECEIPT'];

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'BIT', 'BANK_TRANSFER', 'OTHER'];

const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const selectClass = inputClass;
const cardClass = 'rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm';
const primaryBtn =
  'rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700';
const subtleBtn =
  'rounded-lg border border-[#d6c8b4] px-3 py-1.5 text-sm text-[#4a4038] hover:bg-[#f7f2ea]';

export default async function SaleEditorPage({ params }: Props) {
  const { saleId } = await params;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const sale = await getSaleWithDetails(business.id, saleId);
  if (!sale) notFound();

  const tz = DEFAULT_TZ;
  const isOpen = sale.status === 'OPEN';
  const dueAgorot = sale.totalAgorot - sale.paidAgorot;

  const [products, services, staff, clients, appointments] = await Promise.all([
    isOpen ? listActiveProducts(business.id) : Promise.resolve([]),
    isOpen ? listServices(business.id) : Promise.resolve([]),
    listStaff(business.id),
    listClients(business.id, { filter: 'active' }),
    getBusinessAppointments(business.id, { order: 'desc', take: 50 }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <div className="mb-2">
        <Link href="/admin/pos" className="text-sm text-brand-700 hover:underline">
          ← {t.admin.pos.backToList}
        </Link>
      </div>

      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
          <h1 className="text-2xl font-bold text-[#1b1715]">
            {t.admin.pos.saleNumber} #{sale.id.slice(-6)}
          </h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[sale.status]}`}
        >
          {STATUS_LABEL[sale.status]}
        </span>
      </header>

      {sale.status === 'COMPLETED' && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <Mascot
            pose="wink"
            circle
            size={44}
            alt={t.brand.success.posAlt}
            className="ring-2 ring-green-200"
          />
          <p className="text-sm font-semibold text-green-800">
            {t.brand.success.posCaption}
          </p>
        </div>
      )}

      {/* פריטים */}
      <section className={`${cardClass} mb-5`}>
        <h2 className="mb-3 text-lg font-semibold text-[#1b1715]">{t.admin.pos.itemsTitle}</h2>
        {sale.items.length === 0 ? (
          <p className="text-sm text-[#8f8478]">{t.admin.pos.noItems}</p>
        ) : (
          <ul className="divide-y divide-[#efe6d8]">
            {sale.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#1b1715]">{item.nameSnapshot}</p>
                  <p className="text-xs text-[#8f8478]">
                    {formatAgorot(item.unitPriceAgorot)} · {t.admin.pos.lineTotal}:{' '}
                    {formatAgorot(item.lineTotalAgorot)}
                  </p>
                </div>
                {isOpen ? (
                  <div className="flex items-center gap-2">
                    <form action={updateItemQuantityAction} className="flex items-center gap-1">
                      <input type="hidden" name="saleId" value={sale.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <input
                        type="number"
                        name="quantity"
                        defaultValue={item.quantity}
                        min={1}
                        step={1}
                        className="w-16 rounded-lg border border-[#d6c8b4] px-2 py-1 text-center text-sm text-[#1b1715]"
                        aria-label={t.admin.pos.quantity}
                      />
                      <button type="submit" className={subtleBtn}>
                        {t.common.save}
                      </button>
                    </form>
                    <form action={removeItemAction}>
                      <input type="hidden" name="saleId" value={sale.id} />
                      <input type="hidden" name="itemId" value={item.id} />
                      <button
                        type="submit"
                        className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                      >
                        {t.admin.pos.remove}
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className="text-sm text-[#6e655f]">× {item.quantity}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* טפסי הוספת פריטים — רק בעסקה פתוחה */}
      {isOpen && (
        <section className="mb-5 grid gap-4 sm:grid-cols-3">
          {/* מוצר */}
          <form action={addProductItemAction} className={cardClass}>
            <input type="hidden" name="saleId" value={sale.id} />
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">
              {t.admin.pos.addProduct}
            </label>
            <select name="productId" className={selectClass} required defaultValue="">
              <option value="" disabled>
                {t.admin.pos.selectProduct}
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatAgorot(p.priceAgorot)}
                </option>
              ))}
            </select>
            <input type="hidden" name="quantity" value={1} />
            <button type="submit" className={`${primaryBtn} mt-3 w-full`}>
              {t.admin.pos.add}
            </button>
          </form>

          {/* שירות */}
          <form action={addServiceItemAction} className={cardClass}>
            <input type="hidden" name="saleId" value={sale.id} />
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">
              {t.admin.pos.addService}
            </label>
            <select name="serviceId" className={selectClass} required defaultValue="">
              <option value="" disabled>
                {t.admin.pos.selectService}
              </option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatAgorot(s.priceAgorot)}
                </option>
              ))}
            </select>
            <input type="hidden" name="quantity" value={1} />
            <button type="submit" className={`${primaryBtn} mt-3 w-full`}>
              {t.admin.pos.add}
            </button>
          </form>

          {/* פריט חופשי */}
          <form action={addCustomItemAction} className={cardClass}>
            <input type="hidden" name="saleId" value={sale.id} />
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">
              {t.admin.pos.addCustom}
            </label>
            <input
              type="text"
              name="name"
              placeholder={t.admin.pos.customName}
              className={`${inputClass} mb-2`}
              required
            />
            <input
              type="number"
              name="price"
              placeholder={t.admin.pos.customPrice}
              min={0}
              step="0.01"
              className={inputClass}
              required
            />
            <input type="hidden" name="quantity" value={1} />
            <button type="submit" className={`${primaryBtn} mt-3 w-full`}>
              {t.admin.pos.add}
            </button>
          </form>
        </section>
      )}

      {/* סיכומים */}
      <section className={`${cardClass} mb-5`}>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#6e655f]">{t.admin.pos.subtotal}</dt>
            <dd className="font-medium text-[#1b1715]">{formatAgorot(sale.subtotalAgorot)}</dd>
          </div>
          {sale.discountAgorot > 0 && (
            <div className="flex justify-between">
              <dt className="text-[#6e655f]">{t.admin.pos.discount}</dt>
              <dd className="font-medium text-red-600">−{formatAgorot(sale.discountAgorot)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-[#efe6d8] pt-1">
            <dt className="font-semibold text-[#1b1715]">{t.admin.pos.total}</dt>
            <dd className="font-bold text-[#1b1715]">{formatAgorot(sale.totalAgorot)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#6e655f]">{t.admin.pos.paid}</dt>
            <dd className="font-medium text-[#1b1715]">{formatAgorot(sale.paidAgorot)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#6e655f]">
              {dueAgorot >= 0 ? t.admin.pos.due : t.admin.pos.change}
            </dt>
            <dd className="font-semibold text-[#1b1715]">{formatAgorot(Math.abs(dueAgorot))}</dd>
          </div>
        </dl>

        {isOpen && (
          <form action={setDiscountAction} className="mt-4 flex items-end gap-2">
            <input type="hidden" name="saleId" value={sale.id} />
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-[#6e655f]">
                {t.admin.pos.discountAmount}
              </label>
              <input
                type="number"
                name="discount"
                min={0}
                step="0.01"
                defaultValue={agorotToShekels(sale.discountAgorot)}
                className={inputClass}
              />
            </div>
            <button type="submit" className={subtleBtn}>
              {t.admin.pos.applyDiscount}
            </button>
          </form>
        )}
      </section>

      {/* שיוך */}
      <section className={`${cardClass} mb-5`}>
        <h2 className="mb-3 text-lg font-semibold text-[#1b1715]">{t.admin.pos.linksTitle}</h2>
        <form action={setSaleLinksAction} className="space-y-3">
          <input type="hidden" name="saleId" value={sale.id} />
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">
              {t.admin.pos.clientLabel}
            </label>
            <select name="clientId" className={selectClass} defaultValue={sale.clientId ?? ''}>
              <option value="">{t.admin.pos.noClient}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">
              {t.admin.pos.appointmentLabel}
            </label>
            <select
              name="appointmentId"
              className={selectClass}
              defaultValue={sale.appointmentId ?? ''}
            >
              <option value="">{t.admin.pos.noAppointment}</option>
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatDateString(a.startAt, tz)} {formatTime(a.startAt, tz)}
                  {a.client ? ` · ${a.client.name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4a4038]">
              {t.admin.pos.staffLabel}
            </label>
            <select name="staffId" className={selectClass} defaultValue={sale.staffId ?? ''}>
              <option value="">{t.admin.pos.noStaff}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={subtleBtn}>
            {t.admin.pos.saveLinks}
          </button>
        </form>
      </section>

      {/* תשלומים */}
      <section className={`${cardClass} mb-5`}>
        <h2 className="mb-3 text-lg font-semibold text-[#1b1715]">{t.admin.pos.paymentsTitle}</h2>
        {sale.payments.length === 0 ? (
          <p className="text-sm text-[#8f8478]">{t.admin.pos.noPayments}</p>
        ) : (
          <ul className="mb-4 divide-y divide-[#efe6d8]">
            {sale.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-[#4a4038]">
                  {METHOD_LABEL[p.method]}
                  {p.reference ? ` · ${p.reference}` : ''}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-[#1b1715]">{formatAgorot(p.amountAgorot)}</span>
                  {isOpen && (
                    <form action={removePaymentAction}>
                      <input type="hidden" name="saleId" value={sale.id} />
                      <input type="hidden" name="paymentId" value={p.id} />
                      <button
                        type="submit"
                        className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        {t.admin.pos.remove}
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {isOpen && (
          <form action={addPaymentAction} className="grid gap-2 sm:grid-cols-4 sm:items-end">
            <input type="hidden" name="saleId" value={sale.id} />
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-[#6e655f]">
                {t.admin.pos.paymentMethod}
              </label>
              <select name="method" className={selectClass} defaultValue="CASH">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-[#6e655f]">
                {t.admin.pos.paymentAmount}
              </label>
              <input type="number" name="amount" min={0} step="0.01" className={inputClass} required />
            </div>
            <div className="sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-[#6e655f]">
                {t.admin.pos.paymentReference}
              </label>
              <input type="text" name="reference" className={inputClass} />
            </div>
            <button type="submit" className={primaryBtn}>
              {t.admin.pos.addPayment}
            </button>
          </form>
        )}
      </section>

      {/* פעולות עסקה */}
      {isOpen && (
        <section className={`${cardClass} mb-5 flex flex-wrap gap-3`}>
          <form action={closeSaleAction}>
            <input type="hidden" name="saleId" value={sale.id} />
            <button type="submit" className={primaryBtn}>
              {t.admin.pos.closeSale}
            </button>
          </form>
          <form action={voidSaleAction}>
            <input type="hidden" name="saleId" value={sale.id} />
            <ConfirmSubmit
              message={t.admin.pos.voidConfirm}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              {t.admin.pos.voidSale}
            </ConfirmSubmit>
          </form>
        </section>
      )}

      {/* הפקת מסמך + מסמכים שהופקו */}
      {sale.status !== 'VOIDED' && (
        <section className={`${cardClass} mb-5`}>
          <h2 className="mb-3 text-lg font-semibold text-[#1b1715]">
            {t.admin.pos.issueDocument}
          </h2>
          {sale.items.length > 0 ? (
            <form action={issueDocumentFromSaleAction} className="flex items-end gap-2">
              <input type="hidden" name="saleId" value={sale.id} />
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[#6e655f]">
                  {t.admin.pos.documentType}
                </label>
                <select name="type" className={selectClass} defaultValue="RECEIPT">
                  {ISSUABLE_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {DOC_TYPE_LABEL[ty]}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className={primaryBtn}>
                {t.admin.pos.issue}
              </button>
            </form>
          ) : (
            <p className="text-sm text-[#8f8478]">{t.admin.pos.noItems}</p>
          )}

          {sale.documents.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-[#4a4038]">
                {t.admin.pos.issuedDocuments}
              </h3>
              <ul className="divide-y divide-[#efe6d8]">
                {sale.documents.map((d) => (
                  <li key={d.id} className="py-2 text-sm">
                    <Link
                      href={`/admin/documents/${d.id}`}
                      className="flex items-center justify-between hover:text-brand-700"
                    >
                      <span>
                        {d.documentNumber} · {DOC_TYPE_LABEL[d.type] ?? d.type}
                      </span>
                      <span className="font-medium">{formatAgorot(d.totalAgorot)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
