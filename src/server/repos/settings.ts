import { prisma } from '@/lib/db';
import type { BusinessType, ReminderChannel } from '@prisma/client';

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
  timezone: string;
};

/** עדכון פרופיל העסק (טבלת Business). */
export async function updateBusinessProfile(businessId: string, data: BusinessProfileInput) {
  return prisma.business.update({ where: { id: businessId }, data });
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

export type TransparencyInput = {
  showPricesPublic: boolean;
  showDurationPublic: boolean;
  showStaffPublic: boolean;
};

/** עדכון מתגי השקיפות בעמוד הציבורי (BusinessSettings). */
export async function updateTransparency(businessId: string, data: TransparencyInput) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: data,
    create: { businessId, ...data },
  });
}

export type CustomTextsInput = {
  welcomeMessage: string | null;
  confirmationMessage: string | null;
  policyText: string | null;
};

/** עדכון הטקסטים המותאמים ללקוח (BusinessSettings). */
export async function updateCustomTexts(businessId: string, data: CustomTextsInput) {
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

/** סימון השלמת ההקמה המודרכת (BusinessSettings). */
export async function setOnboardingCompleted(businessId: string, completed: boolean) {
  return prisma.businessSettings.upsert({
    where: { businessId },
    update: { onboardingCompleted: completed },
    create: { businessId, onboardingCompleted: completed },
  });
}
