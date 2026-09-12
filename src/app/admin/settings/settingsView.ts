import type { Business, BusinessSettings } from '@prisma/client';

export type SettingsBusinessView = Pick<
  Business,
  | 'name'
  | 'type'
  | 'phone'
  | 'address'
  | 'description'
  | 'instagramUrl'
  | 'logoUrl'
  | 'coverImageUrl'
  | 'brandColor'
  | 'timezone'
  | 'publicPageStyle'
  | 'landingContent'
>;

export type SettingsValuesView = Pick<
  BusinessSettings,
  | 'minLeadTimeMinutes'
  | 'cancellationWindowHours'
  | 'slotGranularityMinutes'
  | 'maxAdvanceBookingDays'
  | 'bookingRequiresApproval'
  | 'remindersEnabled'
  | 'reminderChannel'
  | 'reminderLeadHours'
  | 'confirmationRequired'
  | 'notifyOnBooking'
  | 'notifyOnCancellation'
  | 'pushEnabled'
  | 'onboardingCompleted'
>;

export function settingsClientView(
  business: Business,
  settings: BusinessSettings,
): { business: Business; settings: BusinessSettings } {
  // SettingsForm still consumes the generated Prisma types. Keep that shared
  // contract stable while replacing every unused scalar with a non-sensitive
  // placeholder before the server-to-client boundary.
  const epoch = new Date(0);
  return {
    business: {
      listed: false,
      id: '',
      slug: '',
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
      publicPageStyle: business.publicPageStyle,
      landingContent: business.landingContent,
      createdAt: epoch,
      updatedAt: epoch,
      ownerId: null,
      ownerEmail: null,
      ownerPhoneIdentity: null,
      provisionedBy: null,
      plan: 'basic',
      subscriptionStatus: 'trialing',
      trialEndsAt: null,
      paidUntil: null,
      manualAmountAgorot: null,
      planNotes: null,
      premiumSince: null,
      priorCalendar: null,
      referralSource: null,
      accountStatus: 'ACTIVE',
      deletionRequestedAt: null,
      purgeScheduledFor: null,
    },
    settings: {
      id: '',
      businessId: '',
      minLeadTimeMinutes: settings.minLeadTimeMinutes,
      cancellationWindowHours: settings.cancellationWindowHours,
      slotGranularityMinutes: settings.slotGranularityMinutes,
      maxAdvanceBookingDays: settings.maxAdvanceBookingDays,
      bookingRequiresApproval: settings.bookingRequiresApproval,
      remindersEnabled: settings.remindersEnabled,
      reminderChannel: settings.reminderChannel,
      reminderLeadHours: settings.reminderLeadHours,
      confirmationRequired: settings.confirmationRequired,
      notifyOnBooking: settings.notifyOnBooking,
      notifyOnCancellation: settings.notifyOnCancellation,
      pushEnabled: settings.pushEnabled,
      waitlistEnabled: false,
      onboardingCompleted: settings.onboardingCompleted,
      onboardingSteps: null,
      createdAt: epoch,
      updatedAt: epoch,
    },
  };
}
