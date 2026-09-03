'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusiness } from '@/server/repos/business';
import { canSendPaidClientSms } from '@/server/subscription';
import { normalizeLandingContent } from '@/lib/publicPageStyle';
import {
  updateBusinessProfile,
  updateBookingPolicy,
  updateReminders,
  updateOwnerNotifications,
} from '@/server/repos/settings';
import {
  parseProfile,
  parsePolicy,
  parseReminders,
  parseOwnerNotifications,
  parseLandingHeroImages,
  parseMessageTemplates,
  type SaveState,
} from './parse';
import { saveMessageTemplateOverrides } from '@/server/repos/messageTemplates';

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

  const ownerNotifications = parseOwnerNotifications(fd);
  if (!ownerNotifications.ok) return { ok: false, error: ownerNotifications.error };

  // באג 13: בעסק בסגנון עמוד נחיתה (LANDING), תמונות ההירו נערכות גם מההגדרות
  // וגם מהאשף, ולכן ממזגים אותן ל-landingContent הקיים ולא דורסים שדות נחיתה
  // אחרים (כותרות, גלריה, מבצעים וכו'). בעסק בסגנון עמוד הזמנה (BOOKING) לא
  // נשלח landingContent כלל, כדי לשמר את התוכן הקיים כפי שהוא.
  const profileData = { ...profile.data };
  if (business.publicPageStyle === 'LANDING') {
    const existing = normalizeLandingContent(business.landingContent) ?? {};
    profileData.landingContent = normalizeLandingContent({
      ...existing,
      heroImages: parseLandingHeroImages(fd),
    });
  }

  await updateBusinessProfile(business.id, profileData);
  await updateBookingPolicy(business.id, policy.data);
  await updateReminders(business.id, reminders.data);
  await updateOwnerNotifications(business.id, ownerNotifications.data);
  // דריסות תבניות ההודעות ללקוחות: תמיד נשמרות (upsert/מחיקה לכל שדה), בלי
  // וולידציה שנכשלת — נוסח ריק או זהה לברירת-המחדל פשוט משחזר.
  await saveMessageTemplateOverrides(business.id, parseMessageTemplates(fd));

  revalidateAll(business.slug);
  return { ok: true };
}
