'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusiness } from '@/server/repos/business';
import {
  updateBusinessProfile,
  updateBookingPolicy,
  updateTransparency,
  updateReminders,
} from '@/server/repos/settings';
import {
  parseProfile,
  parsePolicy,
  parseTransparency,
  parseReminders,
  type SaveState,
} from './parse';

/** מצב אחיד לכל טופס הגדרות (useActionState). מיוצא מחדש מ-parse. */
export type { SaveState } from './parse';

/** רענון עמודי הניהול וההקמה, ועמוד העסק הציבורי. */
function revalidateAll(slug: string): void {
  revalidatePath('/admin/settings');
  revalidatePath('/admin/onboarding');
  revalidatePath(`/b/${slug}`);
}

/**
 * שמירת כל סעיפי ההגדרות בבת אחת: פרופיל העסק וכל שדות ה-BusinessSettings.
 * מנתח קודם את הסעיפים שיש בהם וולידציה (פרופיל, מדיניות, תזכורות) ומחזיר
 * את השגיאה הראשונה, ורק אז כותב את כל הסעיפים כדי שלא תישאר כתיבה חלקית.
 */
export async function saveAllSettingsAction(
  _prev: SaveState,
  fd: FormData,
): Promise<SaveState> {
  const profile = parseProfile(fd);
  if (!profile.ok) return { ok: false, error: profile.error };

  const policy = parsePolicy(fd);
  if (!policy.ok) return { ok: false, error: policy.error };

  const reminders = parseReminders(fd);
  if (!reminders.ok) return { ok: false, error: reminders.error };

  const transparency = parseTransparency(fd);

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  await updateBusinessProfile(business.id, profile.data);
  await updateBookingPolicy(business.id, policy.data);
  await updateTransparency(business.id, transparency);
  await updateReminders(business.id, reminders.data);

  revalidateAll(business.slug);
  return { ok: true };
}
