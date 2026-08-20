'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getActiveBusiness } from '@/server/repos/business';
import {
  updateBusinessProfile,
  setOnboardingCompleted,
  type BusinessProfileInput,
} from '@/server/repos/settings';
import { createService, setServiceHidden } from '@/server/repos/services';
import { setBusinessHours } from '@/server/repos/workingHours';
import { workingHoursPreset, type HoursPresetKey } from '@/server/onboarding/hoursPresets';
import type { SaveState } from '../settings/parse';
import { ONBOARDING_CHECKLIST_DISMISS_COOKIE } from './checklistState';

/**
 * פעולות אשף ההקמה המודרך (מסלול העסק החדש):
 * אישור שירותים → שעות פעילות → מיתוג → סימון סיום.
 * כל צעד מגן ב-getActiveBusiness ומרענן את המסכים המושפעים.
 */

function revalidateAll(slug: string): void {
  revalidatePath('/admin/onboarding');
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath(`/b/${slug}`);
}

/** ₪ → אגורות (מספר שלם); מחזיר 0 עבור קלט ריק או לא-תקין. */
function shekelToAgorot(raw: string): number {
  const n = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

const HOURS_PRESET_KEYS: readonly HoursPresetKey[] = ['sun-thu', 'every-day', 'custom'];

/** צעד 1 — אישור השירותים שנזרעו לפי סוג העסק (החלפת הצגה + הוספת שירות משלך). */
export async function saveServices(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  let activeCount = 0;
  const toggles: { id: string; hidden: boolean }[] = [];
  for (const [key, value] of fd.entries()) {
    if (!key.startsWith('svc:') || typeof value !== 'string') continue;
    const id = key.slice('svc:'.length);
    const on = value === 'on';
    if (on) activeCount += 1;
    toggles.push({ id, hidden: !on });
  }

  const newName = (fd.get('newName') as string | null)?.trim() ?? '';
  if (activeCount === 0 && newName === '') return { ok: false, error: 'generic' };

  for (const tog of toggles) {
    await setServiceHidden(business.id, tog.id, tog.hidden);
  }

  if (newName !== '') {
    const durationMin = Number.parseInt((fd.get('newDuration') as string | null) ?? '', 10);
    await createService(business.id, {
      name: newName,
      description: null,
      durationMin: Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 30,
      priceAgorot: shekelToAgorot((fd.get('newPrice') as string | null) ?? ''),
      hidePrice: false,
      hideDuration: false,
      hidden: false,
    });
  }

  revalidateAll(business.slug);
  return { ok: true };
}

/** צעד 2 — שעות פעילות מתבנית בלחיצה אחת. */
export async function saveHours(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  const raw = (fd.get('preset') as string | null) ?? 'sun-thu';
  const preset: HoursPresetKey = HOURS_PRESET_KEYS.includes(raw as HoursPresetKey)
    ? (raw as HoursPresetKey)
    : 'sun-thu';

  await setBusinessHours(business.id, workingHoursPreset(preset));
  revalidateAll(business.slug);
  return { ok: true };
}

/** צעד 3 — מיתוג (לוגו + צבע מותג), ובסיומו סימון ההקמה כהושלמה. */
export async function saveBranding(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  const logoUrl = ((fd.get('logoUrl') as string | null) ?? '').trim();
  const brandColor = ((fd.get('brandColor') as string | null) ?? '').trim();

  const profile: BusinessProfileInput = {
    name: business.name,
    type: business.type,
    phone: business.phone,
    address: business.address,
    description: business.description,
    instagramUrl: business.instagramUrl,
    logoUrl: logoUrl === '' ? null : logoUrl,
    coverImageUrl: business.coverImageUrl,
    brandColor: brandColor === '' ? business.brandColor : brandColor,
    timezone: business.timezone,
  };

  await updateBusinessProfile(business.id, profile);
  await setOnboardingCompleted(business.id, true);
  revalidateAll(business.slug);
  return { ok: true };
}

/**
 * הסתרת רשימת ההמשך של ההקמה בלוח הניהול.
 * שומר עוגייה ייעודית (לא נוגע ב-onboardingCompleted) ומרענן את הלוח.
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
