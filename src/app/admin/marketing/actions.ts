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
import { normalizeChannels } from '@/server/campaigns/channels';
import { localWallTimeToUtc } from '@/lib/time';

const createSchema = z.object({
  name: z.string().trim().min(1, 'name').max(120),
  body: z.string().trim().min(1, 'body').max(1000),
  segment: z.enum(['all', 'active', 'with_appointments']),
});

export type CreateCampaignState = {
  ok: boolean;
  error?: string;
  /** האם הקמפיין תוזמן (SCHEDULED) לעומת נשמר כטיוטה — לצורך הודעת ההצלחה. */
  scheduled?: boolean;
};

/**
 * ניתוח קלט datetime-local ("YYYY-MM-DDTHH:mm", שעון-קיר מקומי) לרגע UTC לפי
 * שעון ישראל. מחזיר null אם הפורמט או הערכים אינם תקינים.
 */
function parseScheduledAt(raw: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const year = Number(y);
  const month1 = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  if (month1 < 1 || month1 > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;
  return localWallTimeToUtc(year, month1, day, hour * 60 + minute);
}

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

  // ערוצי שליחה: לפחות ערוץ אחד תקין (email/sms/whatsapp; 'all' מתרחב לכולם).
  const channels = normalizeChannels(
    formData.getAll('channels').map((v) => String(v)),
  );
  if (channels.length === 0) {
    return { ok: false, error: 'channel' };
  }

  // מועד שליחה: 'now' => טיוטה לשליחה ידנית; 'later' => תזמון למועד עתידי תקין.
  const mode = String(formData.get('scheduleMode') ?? 'now');
  let scheduledAt: Date | null = null;
  if (mode === 'later') {
    scheduledAt = parseScheduledAt(String(formData.get('scheduledAt') ?? ''));
    if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
      return { ok: false, error: 'schedule' };
    }
  }

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'generic' };

  // הגנה נוספת: ודא שהסגמנט מוכר.
  if (!CAMPAIGN_SEGMENTS.includes(parsed.data.segment)) {
    return { ok: false, error: 'generic' };
  }

  try {
    await createCampaign(business.id, { ...parsed.data, channels, scheduledAt });
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
