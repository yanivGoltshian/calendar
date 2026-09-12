import { auth } from '@/auth';
import { getActiveBusiness } from '@/server/repos/business';
import { getImpersonatedBusinessId } from '@/server/impersonation';
import { createUploadHandler } from './uploadHandler';
import { storeBusinessMedia } from './storage';

export const uploadMedia = createUploadHandler({
  email: async () => (await auth())?.user?.email ?? null,
  business: async () => getActiveBusiness(),
  configured: () => !!process.env.MEDIA_STORAGE_CONNECTION,
  store: async (id, email, data, type, ext) =>
    storeBusinessMedia(id, email, data, type, ext, undefined, await getImpersonatedBusinessId()),
});
