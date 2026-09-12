import { createCampaignAction } from '@/app/admin/marketing/actions';
import { createAdminFormPost } from '@/server/adminFormRoute';
import { getActiveBusiness } from '@/server/repos/business';

export const runtime = 'nodejs';
export const POST = createAdminFormPost(
  data => createCampaignAction({ ok: false }, data),
  async () => Boolean(await getActiveBusiness()),
);
