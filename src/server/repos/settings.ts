import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { BusinessType, PublicPageStyle, ReminderChannel } from '@prisma/client';
import type { LandingContent } from '@/lib/publicPageStyle';
import { patchLandingBranding, type LandingBrandingPatch } from '@/lib/branding';
import {
  parseOnboardingSteps,
  type OnboardingStepKey,
} from '@/server/onboardingProgress';

/**
 * Repo של מודול ההקמה וההגדרות.
 * ניגש ישירות ל-BusinessSettings ולפרופיל Business, בלי לגעת ב-repos של מודולים אחרים.
 */

/** מבטיח קיום שורת הגדרות לעסק ומחזיר אותה (עם ברירות מחדל מהסכימה). */
export async function getOrCreateSettings(businessId: string) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: {},
    create: { businessId },
  });
}

export type BusinessProfileInput = {
  name: string;
  type: BusinessType | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  instagramUrl: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  brandColor: string | null;
  timezone: string;
  publicPageStyle?: PublicPageStyle;
  landingContent?: LandingContent | null;
};

/** עדכון פרופיל העסק (טבלת Business). */
export async function updateBusinessProfile(
  businessId: string,
  data: BusinessProfileInput,
  brandingPatch?: LandingBrandingPatch,
) {
  const { publicPageStyle, landingContent, ...rest } = data;
  const update = (client: Pick<Prisma.TransactionClient, 'business'>, content = landingContent) => client.business.update({
    where: { id: businessId },
    data: {
      ...rest,
      // סגנון העמוד נכתב רק כשנשלח (מסך ההגדרות), כדי לא לדרוס בזמן ההקמה.
      ...(publicPageStyle !== undefined ? { publicPageStyle } : {}),
      // Json אופציונלי: ריק ⇐ DbNull במפורש, אחרת נשמר האובייקט המנורמל.
      ...(content !== undefined
        ? {
            landingContent:
              content === null
                ? Prisma.DbNull
                : (content as unknown as Prisma.InputJsonValue),
          }
        : {}),
    },
  });
  if (!brandingPatch || Object.values(brandingPatch).every(value => value === undefined)) return update(prisma);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
    const current = await tx.business.findUniqueOrThrow({
      where: { id: businessId }, select: { landingContent: true },
    });
    return update(tx, patchLandingBranding(current.landingContent, brandingPatch));
  });
}

export type BookingPolicyInput = {
  minLeadTimeMinutes: number;
  cancellationWindowHours: number;
  slotGranularityMinutes: number;
  maxAdvanceBookingDays: number;
  bookingRequiresApproval: boolean;
};

/** עדכון מדיניות ההזמנה (BusinessSettings). */
export async function updateBookingPolicy(businessId: string, data: BookingPolicyInput) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: data,
    create: { businessId, ...data },
  });
}

export type RemindersInput = {
  remindersEnabled: boolean;
  reminderChannel: ReminderChannel;
  reminderLeadHours: number;
  confirmationRequired: boolean;
};

/** עדכון תצורת תזכורות ואישורים (BusinessSettings). */
export async function updateReminders(businessId: string, data: RemindersInput) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: data,
    create: { businessId, ...data },
  });
}

export type OwnerNotificationsInput = {
  notifyOnBooking: boolean;
  notifyOnCancellation: boolean;
  pushEnabled: boolean;
};

/** עדכון מתגי התראות בעל העסק (הזמנה/ביטול/פוש) ב-BusinessSettings. */
export async function updateOwnerNotifications(
  businessId: string,
  data: OwnerNotificationsInput,
) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: data,
    create: { businessId, ...data },
  });
}

/**
 * כיבוי/הפעלה של רשימת ההמתנה פר-עסק (BusinessSettings.waitlistEnabled).
 * מקור האמת היחיד לדגל; נכתב מעמוד ניהול רשימת ההמתנה בלבד (/admin/waitlist).
 */
export async function setWaitlistEnabled(businessId: string, enabled: boolean) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: { waitlistEnabled: enabled },
    create: { businessId, waitlistEnabled: enabled },
  });
}

/** סימון השלמת ההקמה המודרכת (BusinessSettings). */
export async function setOnboardingCompleted(businessId: string, completed: boolean) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: { onboardingCompleted: completed },
    create: { businessId, onboardingCompleted: completed },
  });
}

/**
 * סימון צעד אונבורדינג יחיד כהושלם ב-BusinessSettings.onboardingSteps (JSON).
 * קורא את ה-JSON הקיים, מוסיף את הצעד כ-true, ומסיר אותו מרשימת ה-skipped אם היה.
 * זהו מקור האמת המפורש לרמת העיטור של העמוד הציבורי (מעל אותות המידע), כך
 * שהשלמת צעד נשמרת גם אם בהמשך מסתירים שירות או משנים נתון.
 */
export async function markOnboardingStep(businessId: string, step: OnboardingStepKey) {
  const existing = await prisma.businessSettings.findUnique({
    where: { businessId },
    select: { onboardingSteps: true },
  });
  const current = parseOnboardingSteps(existing?.onboardingSteps);
  const skipped = (current.skipped ?? []).filter((s) => s !== step);
  const next: Record<string, unknown> = { ...current, [step]: true };
  if (skipped.length > 0) next.skipped = skipped;
  else delete next.skipped;

  return prisma.businessSettings.upsert({
    where: { businessId },
    update: { onboardingSteps: next as Prisma.InputJsonValue },
    create: { businessId, onboardingSteps: next as Prisma.InputJsonValue },
  });
}
