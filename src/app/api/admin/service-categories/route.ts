import { revalidatePath } from 'next/cache';
import { createAdminFormPost } from '@/server/adminFormRoute';
import { getActiveBusiness } from '@/server/repos/business';
import { saveServiceCategories } from '@/server/repos/serviceCategories';

export const runtime = 'nodejs';
export const POST = createAdminFormPost(
  async data => {
    const business = await getActiveBusiness();
    if (!business) return { ok: false, error: 'no_business' };
    let input: unknown;
    try {
      input = JSON.parse(String(data.get('categories') ?? ''));
    } catch {
      return { ok: false, error: 'bad_request' };
    }
    const result = await saveServiceCategories(business.id, input);
    if (result.ok) {
      revalidatePath('/admin/services');
      revalidatePath('/admin/onboarding');
      revalidatePath(`/b/${business.slug}`);
      revalidatePath(`/b/${business.slug}/book`);
    }
    return result;
  },
  async () => Boolean(await getActiveBusiness()),
);
