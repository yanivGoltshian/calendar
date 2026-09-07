import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
import { createUploadHandler } from './uploadHandler';
import { storeBusinessMedia } from './storage';

export const uploadMedia = createUploadHandler({
  email: async () => (await auth())?.user?.email ?? null,
  business: async (email) => (await getBusinessesOwnedByEmail(email))[0] ?? null,
  configured: () => !!process.env.MEDIA_STORAGE_CONNECTION,
  store: storeBusinessMedia,
});
