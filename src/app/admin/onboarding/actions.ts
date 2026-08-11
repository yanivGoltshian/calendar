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
  setOnboardingCompleted,
} from '@/server/repos/settings';
import type { SaveState } from '../settings/actions';

/**
 * פעולות אשף ההקמה. כל צעד שומר את סעיפו דרך אותו repo של ההגדרות,
 * והצעד האחרון גם מסמן את ההקמה כהושלמה.
 */

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}
function nullableStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v ? v : null;
}
function checkbox(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

const businessTypeValues = Object.values(BusinessType) as string[];
const reminderChannelValues = Object.values(ReminderChannel) as string[];

function revalidateAll(slug: string): void {
  revalidatePath('/admin/onboarding');
  revalidatePath('/admin/settings');
  revalidatePath(`/b/${slug}`);
}

/** צעד 1 — פרופיל. */
export async function saveOnboardingProfile(
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

/** צעד 2 — מדיניות הזמנה. */
export async function saveOnboardingPolicy(
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

/** צעד 3 — שקיפות וטקסטים. */
export async function saveOnboardingPresentation(
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
  await updateCustomTexts(business.id, {
    welcomeMessage: nullableStr(fd, 'welcomeMessage'),
    confirmationMessage: nullableStr(fd, 'confirmationMessage'),
    policyText: nullableStr(fd, 'policyText'),
  });

  revalidateAll(business.slug);
  return { ok: true };
}

/** צעד 4 — תזכורות, וסימון סיום ההקמה. */
export async function finishOnboarding(
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
  await setOnboardingCompleted(business.id, true);

  revalidateAll(business.slug);
  return { ok: true };
}
