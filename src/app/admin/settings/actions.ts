'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { BusinessType, ReminderChannel } from '@prisma/client';
import { getActiveBusiness } from '@/server/repos/business';
import {
  updateBusinessProfile,
  updateBookingPolicy,
  updateTransparency,
  updateCustomTexts,
  updateReminders,
} from '@/server/repos/settings';

/** מצב אחיד לכל טופס סעיף בהגדרות (useActionState). */
export type SaveState = { ok: boolean; error?: string };

/** קורא ערך טקסט נקי מ-FormData. */
function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

/** מחזיר מחרוזת או null כשריק. */
function nullableStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v ? v : null;
}

/** תיבת סימון: קיימת ומסומנת ⇐ true. */
function checkbox(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

const businessTypeValues = Object.values(BusinessType) as string[];
const reminderChannelValues = Object.values(ReminderChannel) as string[];

/** רענון עמודי הניהול וההקמה, ועמוד העסק הציבורי. */
function revalidateAll(slug: string): void {
  revalidatePath('/admin/settings');
  revalidatePath('/admin/onboarding');
  revalidatePath(`/b/${slug}`);
}

/** פרופיל העסק — סעיף 1. */
export async function saveProfileAction(
  _prev: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const name = str(fd, 'name');
  if (!name) return { ok: false, error: 'name' };

  const rawType = str(fd, 'type');
  let type: BusinessType | null = null;
  if (rawType) {
    if (!businessTypeValues.includes(rawType)) return { ok: false, error: 'bad_request' };
    type = rawType as BusinessType;
  }

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  await updateBusinessProfile(business.id, {
    name,
    type,
    phone: nullableStr(fd, 'phone'),
    address: nullableStr(fd, 'address'),
    description: nullableStr(fd, 'description'),
    instagramUrl: nullableStr(fd, 'instagramUrl'),
    logoUrl: nullableStr(fd, 'logoUrl'),
    coverImageUrl: nullableStr(fd, 'coverImageUrl'),
    brandColor: nullableStr(fd, 'brandColor'),
    timezone: str(fd, 'timezone') || 'Asia/Jerusalem',
  });

  revalidateAll(business.slug);
  return { ok: true };
}

const policySchema = z.object({
  minLeadTimeMinutes: z.coerce.number().int().min(0),
  cancellationWindowHours: z.coerce.number().int().min(0),
  slotGranularityMinutes: z.coerce.number().int().min(1),
  maxAdvanceBookingDays: z.coerce.number().int().min(1),
});

/** מדיניות ההזמנה — סעיף 2. */
export async function savePolicyAction(
  _prev: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const parsed = policySchema.safeParse({
    minLeadTimeMinutes: fd.get('minLeadTimeMinutes'),
    cancellationWindowHours: fd.get('cancellationWindowHours'),
    slotGranularityMinutes: fd.get('slotGranularityMinutes'),
    maxAdvanceBookingDays: fd.get('maxAdvanceBookingDays'),
  });
  if (!parsed.success) return { ok: false, error: 'number' };

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  await updateBookingPolicy(business.id, {
    ...parsed.data,
    bookingRequiresApproval: checkbox(fd, 'bookingRequiresApproval'),
  });

  revalidateAll(business.slug);
  return { ok: true };
}

/** מתגי שקיפות בעמוד הציבורי — סעיף 3. */
export async function saveTransparencyAction(
  _prev: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  await updateTransparency(business.id, {
    showPricesPublic: checkbox(fd, 'showPricesPublic'),
    showDurationPublic: checkbox(fd, 'showDurationPublic'),
    showStaffPublic: checkbox(fd, 'showStaffPublic'),
  });

  revalidateAll(business.slug);
  return { ok: true };
}

/** טקסטים מותאמים — סעיף 4. */
export async function saveTextsAction(
  _prev: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  await updateCustomTexts(business.id, {
    welcomeMessage: nullableStr(fd, 'welcomeMessage'),
    confirmationMessage: nullableStr(fd, 'confirmationMessage'),
    policyText: nullableStr(fd, 'policyText'),
  });

  revalidateAll(business.slug);
  return { ok: true };
}

/** תזכורות ואישורים — סעיף 5. */
export async function saveRemindersAction(
  _prev: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const leadParsed = z.coerce.number().int().min(0).safeParse(fd.get('reminderLeadHours'));
  if (!leadParsed.success) return { ok: false, error: 'number' };

  const rawChannel = str(fd, 'reminderChannel');
  const channel: ReminderChannel = reminderChannelValues.includes(rawChannel)
    ? (rawChannel as ReminderChannel)
    : ReminderChannel.SMS;

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  await updateReminders(business.id, {
    remindersEnabled: checkbox(fd, 'remindersEnabled'),
    reminderChannel: channel,
    reminderLeadHours: leadParsed.data,
    confirmationRequired: checkbox(fd, 'confirmationRequired'),
  });

  revalidateAll(business.slug);
  return { ok: true };
}
