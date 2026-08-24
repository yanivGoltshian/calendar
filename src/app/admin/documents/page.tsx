import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listDocuments, type DocumentFilter } from '@/server/repos/documents';
import type { DocumentType } from '@prisma/client';
import { formatAgorot } from '@/lib/money';
import { formatDateString } from '@/lib/time';

export const metadata: Metadata = { title: t.admin.documents.title };

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

const TABS: { key: DocumentFilter; label: string }[] = [
  { key: 'all', label: t.admin.documents.tabs.all },
  { key: 'RECEIPT', label: t.admin.documents.tabs.receipt },
  { key: 'TAX_INVOICE', label: t.admin.documents.tabs.taxInvoice },
  { key: 'INVOICE_RECEIPT', label: t.admin.documents.tabs.invoiceReceipt },
  { key: 'CREDIT_NOTE', label: t.admin.documents.tabs.creditNote },
];

const TYPE_LABEL: Record<DocumentType, string> = {
  RECEIPT: t.admin.documents.typeReceipt,
  TAX_INVOICE: t.admin.documents.typeTaxInvoice,
  INVOICE_RECEIPT: t.admin.documents.typeInvoiceReceipt,
  CREDIT_NOTE: t.admin.documents.typeCreditNote,
};

function isFilter(v: string | undefined): v is DocumentFilter {
  return (
    v === 'all' ||
    v === 'RECEIPT' ||
    v === 'TAX_INVOICE' ||
    v === 'INVOICE_RECEIPT' ||
    v === 'CREDIT_NOTE'
  );
}

export default async function DocumentsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const filter: DocumentFilter = isFilter(sp.tab) ? sp.tab : 'all';
  const documents = await listDocuments(business.id, filter);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">
          {t.admin.documents.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-[#8f8478]">{t.admin.documents.subtitle}</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = tab.key === filter;
          const href =
            tab.key === 'all' ? '/admin/documents' : `/admin/documents?tab=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`rounded-full px-3 py-1 text-sm ${
                active ? 'bg-brand-600 text-white' : 'border border-[#d6c8b4] text-[#6e655f]'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {documents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d6c8b4] bg-white p-6 text-center text-sm text-[#8f8478]">
          {t.admin.documents.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/admin/documents/${doc.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1b1715]" dir="ltr">
                      {doc.documentNumber}
                    </span>
                    <span className="rounded-full bg-[#efe6d8] px-2 py-0.5 text-xs text-[#6e655f]">
                      {TYPE_LABEL[doc.type]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[#8f8478]">
                    {doc.clientName || t.admin.documents.noClient} ·{' '}
                    {formatDateString(doc.issuedAt)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-[#1b1715]">
                  {formatAgorot(doc.totalAgorot)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
