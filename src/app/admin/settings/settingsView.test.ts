import assert from 'node:assert/strict';
import test from 'node:test';
import { settingsClientView } from './settingsView';

test('settings client view removes sensitive values before the client boundary', () => {
  const business = {
    listed: true,
    id: 'business-secret-id',
    slug: 'business',
    name: 'עסק',
    type: null,
    phone: '0500000000',
    address: 'כתובת',
    description: 'תיאור',
    instagramUrl: null,
    logoUrl: null,
    coverImageUrl: null,
    brandColor: null,
    timezone: 'Asia/Jerusalem',
    publicPageStyle: 'BOOKING' as const,
    landingContent: {
      announcement: 'Saved announcement',
      googleReviewsUrl: 'https://example.com/reviews',
      heroVideoUrl: '/media/owned-video.mp4',
      sections: { highlights: false },
    },
    businessImportDraft: { privateImportNotes: 'not for settings' },
    createdAt: new Date(),
    updatedAt: new Date(),
    ownerId: 'owner-secret-id',
    ownerEmail: 'owner@example.com',
    planNotes: 'internal',
    manualAmountAgorot: 12345,
    ownerPhoneIdentity: '+972500000000',
    provisionedBy: 'admin@example.com',
    plan: 'exclusive' as const,
    subscriptionStatus: 'active' as const,
    trialEndsAt: new Date(),
    paidUntil: new Date(),
    premiumSince: new Date(),
    priorCalendar: 'secret',
    referralSource: 'secret',
    accountStatus: 'ACTIVE' as const,
    deletionRequestedAt: null,
    purgeScheduledFor: null,
  };
  const settings = {
    id: 'settings-secret-id',
    businessId: 'business-secret-id',
    minLeadTimeMinutes: 0,
    cancellationWindowHours: 0,
    slotGranularityMinutes: 30,
    maxAdvanceBookingDays: 30,
    bookingRequiresApproval: false,
    remindersEnabled: true,
    reminderChannel: 'AUTO' as const,
    reminderLeadHours: 24,
    confirmationRequired: true,
    notifyOnBooking: true,
    notifyOnCancellation: true,
    pushEnabled: true,
    waitlistEnabled: true,
    onboardingCompleted: true,
    onboardingSteps: { secretDraft: true },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const view = settingsClientView(business, settings);
  assert.deepEqual(Object.keys(view.business).sort(), [
    'name', 'type', 'phone', 'address', 'description', 'instagramUrl', 'logoUrl',
    'coverImageUrl', 'brandColor', 'timezone', 'publicPageStyle', 'landingContent',
  ].sort());
  assert.deepEqual(Object.keys(view.settings).sort(), [
    'minLeadTimeMinutes', 'cancellationWindowHours', 'slotGranularityMinutes',
    'maxAdvanceBookingDays', 'bookingRequiresApproval', 'remindersEnabled',
    'reminderChannel', 'reminderLeadHours', 'confirmationRequired', 'notifyOnBooking',
    'notifyOnCancellation', 'pushEnabled', 'onboardingCompleted',
  ].sort());
  assert.equal(view.business.landingContent, business.landingContent);
  assert.equal(view.business.name, business.name);
  assert.equal(view.business.phone, business.phone);
  assert.equal(view.business.address, business.address);
  assert.equal(view.settings.reminderChannel, settings.reminderChannel);
});
