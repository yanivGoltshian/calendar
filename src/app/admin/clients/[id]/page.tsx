import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { getClientWithHistory } from '@/server/repos/clients';
import { displayPhone } from '@/lib/crypto';
import { formatAgorot } from '@/lib/money';
import { formatTime, formatDateString, formatLongDate, DEFAULT_TZ } from '@/lib/time';
import ClientForm, { type ClientFormValues } from '../ClientForm';
import { toggleClientBlockedAction } from '../actions';

export const metadata: Metadata = { title: t.admin.clients.title };

type Props = {
  params: Promise<{ id: string }>;
};

// מיפוי סטטוס תור לצבעי תווית בהירים.
const statusClass: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  ARRIVED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
  DONE: 'bg-[#e7ddcd] text-[#6e655f]',
  NO_SHOW: 'bg-red-100 text-red-700',
};

export default async function AdminClientDetailPage({ params }: Props) {
  const { id } = await params;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const client = await getClientWithHistory(business.id, id);
  if (!client) notFound();

  const initial: ClientFormValues = {
    id: client.id,
    name: client.name,
    phone: client.phone ?? '',
    email: client.email ?? '',
    notes: client.notes ?? '',
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <Link
          href="/admin/clients"
          className="text-sm font-medium text-[#8f8478] transition hover:text-[#4a4038] hover:underline"
        >
          ← {t.admin.clients.backToList}
        </Link>
        <p className="mt-2 text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-[#1b1715]">
          {client.name}
          {client.blocked ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-sm font-medium text-red-700">
              {t.admin.clients.blockedBadge}
            </span>
          ) : null}
        </h1>
      </header>

      {client.blocked ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t.admin.clients.blockedNotice}
        </p>
      ) : null}

      {/* פרטי קשר + חסימה */}
      <section className="rounded-xl border border-[#e7ddcd] bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-bold text-[#1b1715]">
          {t.admin.clients.contactTitle}
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[#8f8478]">{t.admin.clients.phoneLabel}</dt>
            <dd className="font-medium text-[#1b1715]" dir="ltr">
              {displayPhone(client.phone)}
            </dd>
          </div>
          {client.email ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[#8f8478]">{t.admin.clients.emailLabel}</dt>
              <dd className="font-medium text-[#1b1715]" dir="ltr">
                {client.email}
              </dd>
            </div>
          ) : null}
        </dl>

        {client.notes ? (
          <div className="mt-3 border-t border-[#efe6d8] pt-3">
            <p className="mb-1 text-sm text-[#8f8478]">{t.admin.clients.notesTitle}</p>
            <p className="whitespace-pre-wrap text-sm text-[#4a4038]">{client.notes}</p>
          </div>
        ) : null}

        <div className="mt-4 border-t border-[#efe6d8] pt-3">
          <form action={toggleClientBlockedAction}>
            <input type="hidden" name="id" value={client.id} />
            <input type="hidden" name="blocked" value={client.blocked ? '0' : '1'} />
            <button
              type="submit"
              className={
                client.blocked
                  ? 'rounded-lg border border-green-200 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-50'
                  : 'rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50'
              }
            >
              {client.blocked ? t.admin.clients.unblock : t.admin.clients.block}
            </button>
          </form>
        </div>
      </section>

      {/* טופס עריכת פרטים */}
      <ClientForm initial={initial} />

      {/* היסטוריית תורים */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-[#1b1715]">
          {t.admin.clients.historyTitle}
        </h2>

        {client.appointments.length === 0 ? (
          <p className="rounded-xl border border-[#e7ddcd] bg-white p-6 text-center text-[#8f8478]">
            {t.admin.clients.historyEmpty}
          </p>
        ) : (
          <ul className="space-y-3">
            {client.appointments.map((appt) => {
              const dateStr = formatDateString(appt.startAt, DEFAULT_TZ);
              const services = appt.services.map((s) => s.nameSnapshot).join(' · ');
              const statusLabel =
                t.admin.statuses[appt.status as keyof typeof t.admin.statuses];
              return (
                <li
                  key={appt.id}
                  className="rounded-xl border border-[#e7ddcd] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-[#1b1715]">
                        {formatLongDate(dateStr, DEFAULT_TZ)}
                        <span className="mx-1 text-[#d6c8b4]">·</span>
                        <span dir="ltr">{formatTime(appt.startAt, DEFAULT_TZ)}</span>
                      </p>
                      {services ? (
                        <p className="mt-0.5 text-sm text-[#6e655f]">{services}</p>
                      ) : null}
                      <p className="mt-0.5 text-sm text-[#8f8478]">
                        {t.admin.clients.withStaff} {appt.staff.displayName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusClass[appt.status] ?? 'bg-[#e7ddcd] text-[#6e655f]'
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <span className="text-sm font-medium text-[#1b1715]">
                        {formatAgorot(appt.totalPriceAgorot)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
