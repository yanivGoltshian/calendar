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
    landingContent: null,
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
  assert.equal(view.business.planNotes, null);
  assert.equal(view.business.manualAmountAgorot, null);
  assert.equal(view.business.ownerPhoneIdentity, null);
  assert.equal(view.business.ownerEmail, null);
  assert.equal(view.business.id, '');
  assert.equal(view.settings.onboardingSteps, null);
  assert.equal(view.settings.businessId, '');
});
