'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusiness } from '@/server/repos/business';
import { canSendPaidClientSms } from '@/server/subscription';
import {
  updateBusinessProfile,
  updateBookingPolicy,
  updateTransparency,
  updateCustomTexts,
  updateReminders,
} from '@/server/repos/settings';
import {
  parseProfile,
  parsePolicy,
  parseTransparency,
  parseTexts,
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

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  // אכיפת התוכנית על ערוץ התזכורות: רק אקסקלוסיב רשאי לבחור מסרון/יחד.
  const reminders = parseReminders(fd, canSendPaidClientSms(business));
  if (!reminders.ok) return { ok: false, error: reminders.error };

  const transparency = parseTransparency(fd);
  const texts = parseTexts(fd);

  await updateBusinessProfile(business.id, profile.data);
  await updateBookingPolicy(business.id, policy.data);
  await updateTransparency(business.id, transparency);
  await updateCustomTexts(business.id, texts);
  await updateReminders(business.id, reminders.data);

  revalidateAll(business.slug);
  return { ok: true };
}
