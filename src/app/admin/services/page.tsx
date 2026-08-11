import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listServicesWithUsage, getServiceById, getServiceStaffIds } from '@/server/repos/services';
import { listStaff } from '@/server/repos/staff';
import { formatAgorot, agorotToShekels } from '@/lib/money';
import { formatDuration } from '@/lib/time';
import ServiceForm, { type ServiceFormValues } from './ServiceForm';
import { deleteServiceAction, toggleServiceHiddenAction } from './actions';

export const metadata: Metadata = { title: t.admin.services.title };

type Props = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function AdminServicesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const services = await listServicesWithUsage(business.id);
  const staff = await listStaff(business.id);
  const staffOptions = staff.map((s) => ({ id: s.id, displayName: s.displayName }));

  const editing = sp.edit ? await getServiceById(business.id, sp.edit) : null;
  const selectedStaffIds = editing
    ? await getServiceStaffIds(business.id, editing.id)
    : [];
  const initial: ServiceFormValues | undefined = editing
    ? {
        id: editing.id,
        name: editing.name,
        description: editing.description ?? '',
        durationMin: editing.durationMin,
        priceShekels: agorotToShekels(editing.priceAgorot),
        hidePrice: editing.hidePrice,
        hideDuration: editing.hideDuration,
        hidden: editing.hidden,
      }
    : undefined;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {t.admin.services.title} · {business.name}
        </h1>
      </header>

      <h2 className="mb-3 text-lg font-bold text-slate-900">
        {t.admin.services.listTitle}
      </h2>

      {services.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {t.admin.services.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {services.map((s) => {
            const inUse = s._count.appointmentServices > 0;
            return (
              <li
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                      {s.name}
                      {s.hidden ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {t.admin.services.hiddenBadge}
                        </span>
                      ) : null}
                    </p>
                    {s.description ? (
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {s.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-slate-600">
                      {s.hideDuration
                        ? t.admin.services.durationHidden
                        : formatDuration(s.durationMin)}
                      <span className="mx-1 text-slate-300">·</span>
                      {s.hidePrice
                        ? t.admin.services.priceHidden
                        : formatAgorot(s.priceAgorot)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{t.admin.services.staffBadgePrefix}</span>
                      {s.staffLinks.length === 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                          {t.admin.services.staffNoneBadge}
                        </span>
                      ) : (
                        s.staffLinks.map((link) => (
                          <span
                            key={link.staff.id}
                            className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700"
                          >
                            {link.staff.displayName}
                          </span>
                        ))
                      )}
                    </p>
                  </div>
                </div>

                {/* פעולות */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Link
                    href={`/admin/services?edit=${s.id}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {t.admin.services.edit}
                  </Link>

                  <form action={toggleServiceHiddenAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="hidden" value={s.hidden ? '0' : '1'} />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      {s.hidden ? t.admin.services.show : t.admin.services.hide}
                    </button>
                  </form>

                  {inUse ? (
                    <span className="rounded-lg px-3 py-1.5 text-sm text-slate-400">
                      {t.admin.services.inUse}
                    </span>
                  ) : (
                    <form action={deleteServiceAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                      >
                        {t.admin.services.delete}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* טופס הוספה/עריכה */}
      <ServiceForm
        key={editing?.id ?? 'new'}
        initial={initial}
        staffOptions={staffOptions}
        selectedStaffIds={selectedStaffIds}
      />
    </main>
  );
}
