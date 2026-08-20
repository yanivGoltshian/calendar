'use server';

import { revalidatePath } from 'next/cache';
import { PublicPageStyle } from '@prisma/client';
import { getActiveBusiness } from '@/server/repos/business';
import {
  updateBusinessProfile,
  setOnboardingCompleted,
  type BusinessProfileInput,
} from '@/server/repos/settings';
import { parseLandingContent, str, type SaveState } from '../../settings/parse';

/**
 * פעולת אשף עמוד הנחיתה המתקדם.
 * מגדירה את סגנון העמוד הציבורי ל-LANDING, שומרת את תוכן הנחיתה המנורמל
 * (אותם שדות טופס של מסך ההגדרות) ומסמנת את ההקמה כהושלמה.
 */
export async function publishLanding(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  const brandColor = str(fd, 'brandColor');

  const profile: BusinessProfileInput = {
    name: business.name,
    type: business.type,
    phone: business.phone,
    address: business.address,
    description: business.description,
    instagramUrl: business.instagramUrl,
    logoUrl: business.logoUrl,
    coverImageUrl: business.coverImageUrl,
    brandColor: brandColor === '' ? business.brandColor : brandColor,
    timezone: business.timezone,
    publicPageStyle: PublicPageStyle.LANDING,
    landingContent: parseLandingContent(fd),
  };

  await updateBusinessProfile(business.id, profile);
  await setOnboardingCompleted(business.id, true);

  revalidatePath('/admin/onboarding/landing');
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath(`/b/${business.slug}`);

  return { ok: true };
}
