import { saveHoursExceptionAction } from '@/app/admin/working-hours/exceptionActions';
import { createAdminFormPost } from '@/server/adminFormRoute';
import { getActiveBusiness } from '@/server/repos/business';

export const runtime = 'nodejs';
export const POST = createAdminFormPost(
  data => saveHoursExceptionAction({ ok: false }, data),
  async () => Boolean(await getActiveBusiness()),
);
