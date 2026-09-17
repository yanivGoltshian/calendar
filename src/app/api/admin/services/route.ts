import { saveServiceAction } from '@/app/admin/services/actions';
import { createAdminFormPost } from '@/server/adminFormRoute';
import { getActiveBusiness } from '@/server/repos/business';
import { listServicesWithUsage } from '@/server/repos/services';
import { toAdminServiceSnapshot } from '@/lib/adminServiceSnapshot';

export const runtime = 'nodejs';
export const POST = createAdminFormPost(
  async data => {
    const state = await saveServiceAction({ ok: false, mode: 'add' }, data);
    if (!state.ok || state.mode !== 'edit') return state;
    const business = await getActiveBusiness();
    const id = String(data.get('id') ?? '').trim();
    const service = business
      ? (await listServicesWithUsage(business.id)).find(service => service.id === id)
      : undefined;
    if (!service) {
      console.error('admin_service_confirmation_missing');
      return { ...state, ok: false, error: 'unconfirmed' };
    }
    return { ...state, service: toAdminServiceSnapshot(service) };
  },
  async () => Boolean(await getActiveBusiness()),
);
