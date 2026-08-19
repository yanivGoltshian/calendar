'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getActiveBusiness } from '@/server/repos/business';
import {
  updateBusinessProfile,
  updateBookingPolicy,
  updateTransparency,
  updateCustomTexts,
  updateReminders,
  setOnboardingCompleted,
} from '@/server/repos/settings';
import {
  parseProfile,
  parsePolicy,
  parseTransparency,
  parseTexts,
  parseReminders,
  type SaveState,
} from '../settings/parse';
import { ONBOARDING_CHECKLIST_DISMISS_COOKIE } from './checklistState';

/**
 * פעולות אשף ההקמה. כל צעד משתמש באותם מנתחי FormData של ההגדרות
 * ושומר את סעיפו דרך אותו repo, והצעד האחרון גם מסמן את ההקמה כהושלמה.
 */

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
  const profile = parseProfile(fd);
  if (!profile.ok) return { ok: false, error: profile.error };

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  await updateBusinessProfile(business.id, profile.data);
  revalidateAll(business.slug);
  return { ok: true };
}

/** צעד 2 — מדיניות הזמנה. */
export async function saveOnboardingPolicy(
  _prev: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const policy = parsePolicy(fd);
  if (!policy.ok) return { ok: false, error: policy.error };

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  await updateBookingPolicy(business.id, policy.data);
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

  await updateTransparency(business.id, parseTransparency(fd));
  await updateCustomTexts(business.id, parseTexts(fd));
  revalidateAll(business.slug);
  return { ok: true };
}

/** צעד 4 — תזכורות, וסימון סיום ההקמה. */
export async function finishOnboarding(
  _prev: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const reminders = parseReminders(fd);
  if (!reminders.ok) return { ok: false, error: reminders.error };

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  await updateReminders(business.id, reminders.data);
  await setOnboardingCompleted(business.id, true);
  revalidateAll(business.slug);
  return { ok: true };
}

/**
 * הסתרת רשימת ההמשך של ההקמה בלוח הניהול.
 * שומר עוגייה ייעודית (לא נוגע ב-onboardingCompleted) ומרענן את הלוח.
 * הרשימה ניתנת להסתרה ידנית ומוסתרת אוטומטית כשכל הצעדים הושלמו.
 */
export async function dismissOnboardingChecklistAction(): Promise<void> {
  const store = await cookies();
  store.set(ONBOARDING_CHECKLIST_DISMISS_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/admin');
}
