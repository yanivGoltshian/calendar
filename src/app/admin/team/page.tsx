import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listAllStaff, getStaffMemberById } from '@/server/repos/staff';
import { displayPhone } from '@/lib/crypto';
import StaffForm, { type StaffFormValues } from './StaffForm';
import { toggleStaffActiveAction, deleteStaffAction } from './actions';

export const metadata: Metadata = { title: t.admin.team.title };

type Props = {
  searchParams: Promise<{ edit?: string }>;
};

export default async function AdminTeamPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const staff = await listAllStaff(business.id);

  const editing = sp.edit ? await getStaffMemberById(business.id, sp.edit) : null;
  const initial: StaffFormValues | undefined = editing
    ? {
        id: editing.id,
        phone: displayPhone(editing.user.phone),
        name: editing.user.name ?? '',
        displayName: editing.displayName,
        title: editing.title ?? '',
        bio: editing.bio ?? '',
        permissionLevel: editing.permissionLevel,
        active: editing.active,
      }
    : undefined;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {t.admin.team.title} · {business.name}
        </h1>
      </header>

      <h2 className="mb-3 text-lg font-bold text-slate-900">
        {t.admin.team.listTitle}
      </h2>

      {staff.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {t.admin.team.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {staff.map((m) => {
            const inUse = m._count.appointments > 0;
            return (
              <li
                key={m.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                    {m.displayName}
                    {!m.active ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t.admin.team.inactiveBadge}
                      </span>
                    ) : null}
                    {m.permissionLevel === 'MANAGER' ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {t.admin.team.managerBadge}
                      </span>
                    ) : null}
                  </p>
                  {m.title ? (
                    <p className="mt-0.5 text-sm text-slate-500">{m.title}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-600" dir="ltr">
                    {displayPhone(m.user.phone)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t.admin.team.appointmentsCount}: {m._count.appointments}
                  </p>
                </div>

                {/* פעולות */}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Link
                    href={`/admin/team?edit=${m.id}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {t.admin.team.edit}
                  </Link>

                  <form action={toggleStaffActiveAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="active" value={m.active ? '0' : '1'} />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      {m.active ? t.admin.team.deactivate : t.admin.team.activate}
                    </button>
                  </form>

                  {inUse ? (
                    <span className="rounded-lg px-3 py-1.5 text-sm text-slate-400">
                      {t.admin.team.inUse}
                    </span>
                  ) : (
                    <form action={deleteStaffAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                      >
                        {t.admin.team.delete}
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
      <StaffForm key={editing?.id ?? 'new'} initial={initial} />
    </main>
  );
}
