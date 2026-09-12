import { deleteHoursExceptionAction } from '@/app/admin/working-hours/exceptionActions';
import { createAdminFormPost } from '@/server/adminFormRoute';
import { getActiveBusiness } from '@/server/repos/business';

export const runtime = 'nodejs';
export const POST = createAdminFormPost(
  data => deleteHoursExceptionAction({ ok: false }, data),
  async () => Boolean(await getActiveBusiness()),
);
