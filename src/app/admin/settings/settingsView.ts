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
  business: SettingsBusinessView,
  settings: SettingsValuesView,
): { business: SettingsBusinessView; settings: SettingsValuesView } {
  return {
    business: {
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
    },
    settings: {
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
      onboardingCompleted: settings.onboardingCompleted,
    },
  };
}
