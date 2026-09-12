import { saveServiceAction } from '@/app/admin/services/actions';
import { createAdminFormPost } from '@/server/adminFormRoute';
import { getActiveBusiness } from '@/server/repos/business';

export const runtime = 'nodejs';
export const POST = createAdminFormPost(
  data => saveServiceAction({ ok: false, mode: 'add' }, data),
  async () => Boolean(await getActiveBusiness()),
);
