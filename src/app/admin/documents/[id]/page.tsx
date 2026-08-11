import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { getDocument } from '@/server/repos/documents';
import type { DocumentType, PaymentMethod } from '@prisma/client';
import { formatAgorot } from '@/lib/money';
import { formatLongDate, formatDateString } from '@/lib/time';
import DocumentToolbar from './DocumentToolbar';

export const metadata: Metadata = { title: t.admin.documents.documentTitle };

type Props = {
  params: Promise<{ id: string }>;
};

const TYPE_LABEL: Record<DocumentType, string> = {
  RECEIPT: t.admin.documents.typeReceipt,
  TAX_INVOICE: t.admin.documents.typeTaxInvoice,
  INVOICE_RECEIPT: t.admin.documents.typeInvoiceReceipt,
  CREDIT_NOTE: t.admin.documents.typeCreditNote,
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: t.admin.pos.methodCash,
  CARD: t.admin.pos.methodCard,
  BIT: t.admin.pos.methodBit,
  BANK_TRANSFER: t.admin.pos.methodBankTransfer,
  OTHER: t.admin.pos.methodOther,
};

const printCss =
  '@media print{.no-print{display:none!important}body{background:#fff!important}}';

export default async function DocumentDetailPage({ params }: Props) {
  const { id } = await params;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const doc = await getDocument(business.id, id);
  if (!doc) notFound();

  const isCredit = doc.type === 'CREDIT_NOTE';
  const items = doc.sale?.items ?? [];
  const payments = doc.sale?.payments ?? [];
  const vatPercent = doc.vatRateBps / 100;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <style dangerouslySetInnerHTML={{ __html: printCss }} />

      <div className="no-print mb-2">
        <Link href="/admin/documents" className="text-sm text-brand-700 hover:underline">
          ← {t.admin.documents.backToList}
        </Link>
      </div>

      <DocumentToolbar documentId={doc.id} isCreditNote={isCredit} />

      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
        {/* כותרת: פרטי העסק וסוג המסמך */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm text-slate-500">{BRAND.name}</p>
            <h1 className="text-xl font-bold text-slate-900">{business.name}</h1>
            {business.phone ? (
              <p className="text-sm text-slate-500" dir="ltr">
                {business.phone}
              </p>
            ) : null}
            {business.address ? (
              <p className="text-sm text-slate-500">{business.address}</p>
            ) : null}
          </div>
          <div className="text-left">
            <p className="text-lg font-bold text-slate-900">{TYPE_LABEL[doc.type]}</p>
            <p className="text-sm text-slate-500" dir="ltr">
              {doc.documentNumber}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatLongDate(formatDateString(doc.issuedAt))}
            </p>
          </div>
        </div>

        {/* פרטי הלקוח */}
        <div className="border-b border-slate-200 py-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">
            {t.admin.documents.clientDetails}
          </h2>
          {doc.clientName || doc.clientPhone ? (
            <div className="text-sm text-slate-600">
              {doc.clientName ? <p>{doc.clientName}</p> : null}
              {doc.clientPhone ? (
                <p dir="ltr">{doc.clientPhone}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t.admin.documents.noClient}</p>
          )}
        </div>

        {/* פירוט השורות */}
        <div className="py-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            {t.admin.documents.itemsTitle}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-1 text-right font-medium">{t.admin.documents.description}</th>
                <th className="py-1 text-center font-medium">{t.admin.documents.quantity}</th>
                <th className="py-1 text-left font-medium">{t.admin.documents.unitPrice}</th>
                <th className="py-1 text-left font-medium">{t.admin.documents.lineTotal}</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-1.5 text-right text-slate-800">{item.nameSnapshot}</td>
                    <td className="py-1.5 text-center text-slate-600">{item.quantity}</td>
                    <td className="py-1.5 text-left text-slate-600">
                      {formatAgorot(item.unitPriceAgorot)}
                    </td>
                    <td className="py-1.5 text-left text-slate-800">
                      {formatAgorot(item.lineTotalAgorot)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 text-right text-slate-800" colSpan={3}>
                    {TYPE_LABEL[doc.type]}
                  </td>
                  <td className="py-1.5 text-left text-slate-800">
                    {formatAgorot(doc.totalAgorot)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* סיכום מע"מ */}
        <div className="border-t border-slate-200 pt-4">
          <dl className="ms-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">{t.admin.documents.subtotal}</dt>
              <dd className="text-slate-800">{formatAgorot(doc.subtotalAgorot)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">
                {t.admin.documents.vat} ({vatPercent}%)
              </dt>
              <dd className="text-slate-800">{formatAgorot(doc.vatAgorot)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-bold">
              <dt className="text-slate-900">{t.admin.documents.totalDue}</dt>
              <dd className="text-slate-900">{formatAgorot(doc.totalAgorot)}</dd>
            </div>
          </dl>
        </div>

        {/* תשלומים */}
        {payments.length > 0 ? (
          <div className="border-t border-slate-200 pt-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              {t.admin.documents.paymentsTitle}
            </h2>
            <ul className="space-y-1 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between text-slate-600">
                  <span>
                    {METHOD_LABEL[p.method]}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                  <span>{formatAgorot(p.amountAgorot)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* מסמך מקור (בזיכוי) */}
        {doc.relatedDocument ? (
          <div className="no-print border-t border-slate-200 pt-4">
            <h2 className="mb-1 text-sm font-semibold text-slate-700">
              {t.admin.documents.relatedDocument}
            </h2>
            <Link
              href={`/admin/documents/${doc.relatedDocument.id}`}
              className="text-sm text-brand-700 hover:underline"
              dir="ltr"
            >
              {doc.relatedDocument.documentNumber}
            </Link>
          </div>
        ) : null}

        {/* זיכויים שהופקו כנגד מסמך זה */}
        {doc.credits.length > 0 ? (
          <div className="no-print border-t border-slate-200 pt-4">
            <h2 className="mb-1 text-sm font-semibold text-slate-700">
              {t.admin.documents.creditsTitle}
            </h2>
            <ul className="space-y-1 text-sm">
              {doc.credits.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/documents/${c.id}`}
                    className="text-brand-700 hover:underline"
                    dir="ltr"
                  >
                    {c.documentNumber}
                  </Link>
                  <span className="text-slate-500"> · {formatAgorot(c.totalAgorot)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* הערה */}
        {doc.note ? (
          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-500">
              <span className="font-semibold">{t.admin.documents.note}: </span>
              {doc.note}
            </p>
          </div>
        ) : null}
      </article>
    </main>
  );
}
