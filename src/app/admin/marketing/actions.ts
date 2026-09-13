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
import { validateCampaignChannelSelection } from '@/server/campaigns/channels';
import { parseCampaignScheduledAt } from '@/server/campaigns/schedule';
import { canSendPaidClientSms } from '@/server/subscription';

const createSchema = z.object({
  name: z.string().trim().min(1, 'name').max(120),
  body: z.string().trim().min(1, 'body').max(1000),
  segment: z.enum(CAMPAIGN_SEGMENTS),
});

export type CreateCampaignState = {
  ok: boolean;
  error?: string;
  /** האם הקמפיין תוזמן (SCHEDULED) לעומת נשמר כטיוטה — לצורך הודעת ההצלחה. */
  scheduled?: boolean;
};

/**
 * יצירת קמפיין חדש. ברירת מחדל — טיוטה (DRAFT) לשליחה ידנית. אם נבחר תזמון עתידי
 * עם מועד תקין, הקמפיין נוצר במצב מתוזמן (SCHEDULED) ויישלח על ידי ה-cron בזמנו.
 */
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

  // מועד שליחה: 'now' => טיוטה לשליחה ידנית; 'later' => תזמון למועד עתידי תקין.
  const mode = String(formData.get('scheduleMode') ?? 'now');
  let scheduledAt: Date | null = null;
  if (mode === 'later') {
    scheduledAt = parseCampaignScheduledAt(String(formData.get('scheduledAt') ?? ''));
    if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
      return { ok: false, error: 'schedule' };
    }
  }

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'generic' };

  const channelSelection = validateCampaignChannelSelection(
    formData.getAll('channels').map((value) => String(value)),
    { isExclusive: canSendPaidClientSms(business) },
  );
  if (!channelSelection.ok) {
    return { ok: false, error: channelSelection.error };
  }

  // הגנה נוספת: ודא שהסגמנט מוכר.
  if (!CAMPAIGN_SEGMENTS.includes(parsed.data.segment)) {
    return { ok: false, error: 'generic' };
  }

  try {
    await createCampaign(business.id, {
      ...parsed.data,
      channels: channelSelection.channels,
      scheduledAt,
    });
  } catch {
    return { ok: false, error: 'generic' };
  }

  revalidatePath('/admin/marketing');
  return { ok: true, scheduled: scheduledAt != null };
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
