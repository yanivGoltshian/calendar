import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listServicesWithUsage } from '@/server/repos/services';
import { listStaff } from '@/server/repos/staff';
import { toAdminServiceSnapshot } from '@/lib/adminServiceSnapshot';
import ServiceForm from './ServiceForm';
import ServiceCard from './ServiceCard';
import { loadServiceTemplatesAction } from './actions';

export const metadata: Metadata = { title: t.admin.services.title };

type Props = {
  searchParams: Promise<{ edit?: string; seeded?: string; error?: string }>;
};

export default async function AdminServicesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const seeded = sp.seeded === '1';
  const business = await getActiveBusiness();
  if (!business) notFound();

  const services = await listServicesWithUsage(business.id);
  const staff = await listStaff(business.id);
  const staffOptions = staff.map((s) => ({ id: s.id, displayName: s.displayName }));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">
          {t.admin.services.title} · {business.name}
        </h1>
      </header>
      {sp.error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {sp.error === 'in_use'
            ? t.admin.services.errorInUse
            : t.admin.services.errorGeneric}
        </p>
      ) : null}

      {seeded ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {t.admin.services.templatesLoaded}
        </p>
      ) : null}

      <h2 className="mb-3 text-lg font-bold text-[#1b1715]">
        {t.admin.services.listTitle}
      </h2>

      {services.length === 0 ? (
        <p className="rounded-xl border border-[#e7ddcd] bg-white p-6 text-center text-[#8f8478]">
          {t.admin.services.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {services.map(service => (
            <ServiceCard
              key={service.id}
              initial={toAdminServiceSnapshot(service)}
              staffOptions={staffOptions}
            />
          ))}
        </ul>
      )}

      {services.length === 0 ? (
        <section className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h3 className="text-base font-bold text-brand-700">
            {t.admin.services.loadTemplatesCta}
          </h3>
          <p className="mt-1 text-sm text-[#6e655f]">
            {t.admin.services.loadTemplatesHint}
          </p>
          <form action={loadServiceTemplatesAction} className="mt-3">
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
            >
              {t.admin.services.loadTemplatesCta}
            </button>
          </form>
        </section>
      ) : null}

      <ServiceForm staffOptions={staffOptions} />
    </main>
  );
}
