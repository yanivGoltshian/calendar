'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getActiveBusiness } from '@/server/repos/business';
import {
  updateBusinessProfile,
  setOnboardingCompleted,
  markOnboardingStep,
  type BusinessProfileInput,
} from '@/server/repos/settings';
import { createService, setServiceHidden, listServices } from '@/server/repos/services';
import { listStaff } from '@/server/repos/staff';
import {
  setBusinessHours,
  getBusinessHours,
  type WorkingHoursRow,
} from '@/server/repos/workingHours';
import {
  workingHoursPreset,
  parseCustomHours,
  type HoursPresetKey,
} from '@/server/onboarding/hoursPresets';
import type { SaveState } from '../settings/parse';
import { ONBOARDING_CHECKLIST_DISMISS_COOKIE } from './checklistState';
import { parsePremiumDraft } from './premium';
import { computeSetupState } from './setup';

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

type PendingService = { name: string; durationMin: number; priceAgorot: number };

/** מנתח את רשימת השירותים החדשים שנשלחה כ-JSON מהאשף, עם הגנה מלאה מפני קלט פגום. */
function parsePendingServices(raw: FormDataEntryValue | null): PendingService[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: PendingService[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (name === '') continue;
    const durationMin =
      typeof rec.durationMin === 'number' && Number.isFinite(rec.durationMin) && rec.durationMin > 0
        ? Math.round(rec.durationMin)
        : 30;
    const priceAgorot =
      typeof rec.priceAgorot === 'number' && Number.isFinite(rec.priceAgorot) && rec.priceAgorot >= 0
        ? Math.round(rec.priceAgorot)
        : 0;
    out.push({ name, durationMin, priceAgorot });
  }
  return out;
}

/** מנתח את שדה השעות המותאמות (JSON) לשורות תקינות; מחזיר [] לקלט פגום. */
function parseCustomHoursField(raw: FormDataEntryValue | null): WorkingHoursRow[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? parseCustomHours(arr) : [];
  } catch {
    return [];
  }
}

/** צעד 1 — אישור השירותים שנזרעו לפי סוג העסק (החלפת הצגה + הוספת שירותים משלך). */
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

  // שירותים חדשים שהבעלים הוסיף: רשימת JSON (כפתור "הוספה") + טיוטה אחרונה שלא נוספה עדיין.
  const pending = parsePendingServices(fd.get('newServices'));
  const draftName = (fd.get('newName') as string | null)?.trim() ?? '';
  if (draftName !== '') {
    const draftDuration = Number.parseInt((fd.get('newDuration') as string | null) ?? '', 10);
    pending.push({
      name: draftName,
      durationMin: Number.isFinite(draftDuration) && draftDuration > 0 ? draftDuration : 30,
      priceAgorot: shekelToAgorot((fd.get('newPrice') as string | null) ?? ''),
    });
  }

  if (activeCount === 0 && pending.length === 0) return { ok: false, error: 'generic' };

  for (const tog of toggles) {
    await setServiceHidden(business.id, tog.id, tog.hidden);
  }

  for (const svc of pending) {
    await createService(business.id, {
      name: svc.name,
      description: null,
      durationMin: svc.durationMin,
      priceAgorot: svc.priceAgorot,
      hidePrice: false,
      hideDuration: false,
      hidden: false,
    });
  }

  await markOnboardingStep(business.id, 'services');
  revalidateAll(business.slug);
  return { ok: true };
}

/** צעד 2 — שעות פעילות מתבנית בלחיצה אחת, או בחירת ימים ושעות ידנית ("מותאם אישית"). */
export async function saveHours(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  const raw = (fd.get('preset') as string | null) ?? 'sun-thu';
  const preset: HoursPresetKey = HOURS_PRESET_KEYS.includes(raw as HoursPresetKey)
    ? (raw as HoursPresetKey)
    : 'sun-thu';

  let hours: WorkingHoursRow[];
  if (preset === 'custom') {
    hours = parseCustomHoursField(fd.get('customHours'));
    // אם לא נבחר אף יום פתוח תקין — נופלים לברירת מחדל שמרנית כדי שהעסק לא יישאר ללא זמינות.
    if (hours.length === 0) hours = workingHoursPreset('custom');
  } else {
    hours = workingHoursPreset(preset);
  }

  await setBusinessHours(business.id, hours);
  await markOnboardingStep(business.id, 'hours');
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
  // סימון צעד המיתוג רק כשקיים מיתוג ממשי (לוגו וגם צבע מותג).
  if (profile.logoUrl && profile.brandColor) {
    await markOnboardingStep(business.id, 'branding');
  }
  revalidateAll(business.slug);
  return { ok: true };
}

/**
 * שלב פרימיום (אופציונלי) — שמירת תוכן עמוד הנחיתה העשיר והדלקת סגנון העמוד.
 * נקרא מכל תת-שלב באשף הפרימיום (שמירה חלקית מותרת): הטיוטה נשלחת כשדה JSON
 * יחיד בשם premiumDraft, מנותחת ומנורמלת דרך parsePremiumDraft, ונכתבת ל-
 * Business.landingContent. במקביל סגנון העמוד הציבורי מוגדר ל-LANDING, כי הבעלים
 * בחר לבנות עמוד פרימיום. שאר שדות הפרופיל מועתקים כפי שהם (ללא שינוי התנהגות).
 */
export async function savePremiumLanding(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  // ניתוח בטוח של טיוטת הפרימיום: null כשאין תוכן ממשי (ישמור NULL במסד).
  const landingContent = parsePremiumDraft(fd.get('premiumDraft'));

  const profile: BusinessProfileInput = {
    name: business.name,
    type: business.type,
    phone: business.phone,
    address: business.address,
    description: business.description,
    instagramUrl: business.instagramUrl,
    logoUrl: business.logoUrl,
    coverImageUrl: business.coverImageUrl,
    brandColor: business.brandColor,
    timezone: business.timezone,
    // הבעלים בחר לבנות עמוד פרימיום ⇐ סגנון העמוד הציבורי הופך ל-LANDING.
    publicPageStyle: 'LANDING',
    landingContent,
  };

  await updateBusinessProfile(business.id, profile);
  // סימון צעד התוכן העשיר רק כשנשמר תוכן נחיתה ממשי (לא NULL).
  if (landingContent !== null) {
    await markOnboardingStep(business.id, 'richContent');
  }
  // יישור דגל «ההקמה הושלמה» לטבעת ההשלמה: אמת אך ורק כשכל חמשת צעדי היצירה
  // הושלמו (שירותים, צוות, שעות פעילות, מיתוג, עמוד פרימיום), נגזר ממקור-האמת
  // computeSetupState כך שהדגל שווה לאחוז מאה ואינו משכפל את תנאי ההשלמה. מנותק
  // לגמרי משדות ההגדרות (כתובת/טלפון/מדיניות). כך הבאנר במסך ההגדרות והכרטיס
  // «מה הלאה» נסגרים בדיוק כשהטבעת מלאה, ולא כשנוצר תוכן פרימיום לבדו.
  const [services, staff, hours] = await Promise.all([
    listServices(business.id),
    listStaff(business.id),
    getBusinessHours(business.id),
  ]);
  const setup = computeSetupState({
    servicesDone: services.length > 0,
    staffDone: staff.length > 0,
    workingHoursDone: hours.length > 0,
    brandingDone: Boolean(
      business.logoUrl || business.brandColor || business.coverImageUrl,
    ),
    premiumDone: landingContent !== null,
  });
  await setOnboardingCompleted(business.id, setup.allComplete);
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
