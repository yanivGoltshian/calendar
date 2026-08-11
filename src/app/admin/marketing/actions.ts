'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getActiveBusiness } from '@/server/repos/business';
import {
  createCampaign,
  sendCampaign,
  normalizeSegment,
  CAMPAIGN_SEGMENTS,
} from '@/server/repos/marketing';

const createSchema = z.object({
  name: z.string().trim().min(1, 'name').max(120),
  body: z.string().trim().min(1, 'body').max(1000),
  segment: z.enum(['all', 'active', 'with_appointments']),
});

export type CreateCampaignState = {
  ok: boolean;
  error?: string;
};

/** יצירת קמפיין חדש במצב טיוטה. */
export async function createCampaignAction(
  _prev: CreateCampaignState,
  formData: FormData,
): Promise<CreateCampaignState> {
  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    body: formData.get('body'),
    segment: normalizeSegment(String(formData.get('segment') ?? 'all')),
  });

  if (!parsed.success) {
    const code = parsed.error.issues[0]?.message;
    const error = code === 'name' || code === 'body' ? code : 'generic';
    return { ok: false, error };
  }

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'generic' };

  // הגנה נוספת: ודא שהסגמנט מוכר.
  if (!CAMPAIGN_SEGMENTS.includes(parsed.data.segment)) {
    return { ok: false, error: 'generic' };
  }

  try {
    await createCampaign(business.id, parsed.data);
  } catch {
    return { ok: false, error: 'generic' };
  }

  revalidatePath('/admin/marketing');
  return { ok: true };
}

/** שליחת קמפיין קיים (טופס כפתור פשוט). התוצאה משתקפת בסטטוס ובספירות. */
export async function sendCampaignAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const business = await getActiveBusiness();
  if (!business) return;

  await sendCampaign(business.id, id);
  revalidatePath('/admin/marketing');
}
