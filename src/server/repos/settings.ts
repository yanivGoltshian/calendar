import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import type { BusinessType, PublicPageStyle, ReminderChannel } from '@prisma/client';
import type { LandingContent } from '@/lib/publicPageStyle';

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
export async function updateBusinessProfile(businessId: string, data: BusinessProfileInput) {
  const { publicPageStyle, landingContent, ...rest } = data;
  return prisma.business.update({
    where: { id: businessId },
    data: {
      ...rest,
      // סגנון העמוד נכתב רק כשנשלח (מסך ההגדרות), כדי לא לדרוס בזמן ההקמה.
      ...(publicPageStyle !== undefined ? { publicPageStyle } : {}),
      // Json אופציונלי: ריק ⇐ DbNull במפורש, אחרת נשמר האובייקט המנורמל.
      ...(landingContent !== undefined
        ? {
            landingContent:
              landingContent === null
                ? Prisma.DbNull
                : (landingContent as unknown as Prisma.InputJsonValue),
          }
        : {}),
    },
  });
}

export type BookingPolicyInput = {
  minLeadTimeMinutes: number;
  cancellationWindowHours: number;
  slotGranularityMinutes: number;
  maxAdvanceBookingDays: number;
  bookingRequiresApproval: boolean;
  // דרוש אימות טלפון (OTP) מהלקוח לפני קביעת תור. ברירת מחדל כבויה (משפך אורח).
  requirePhoneVerification: boolean;
  // אפשר קביעת תור גם ללא מספר טלפון כלל. ברירת מחדל כבויה.
  allowBookingWithoutPhone: boolean;
  // דרוש כתובת מייל בקביעת תור. ברירת מחדל דלוקה (מומלץ טלפון + מייל; המייל גם ערוץ
  // החיבור עם גוגל). בשליטת הבעלים ומנותק מהמסלול.
  requireEmail: boolean;
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
