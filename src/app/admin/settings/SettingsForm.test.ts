import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { t } from '@/i18n';
import SettingsForm from './SettingsForm';

Object.assign(globalThis, { React });

const props: React.ComponentProps<typeof SettingsForm> = {
  business: {
    name: 'Synthetic studio', type: 'OTHER', phone: '030000000', address: 'Synthetic address',
    description: null, instagramUrl: null, logoUrl: null, coverImageUrl: null,
    brandColor: null, timezone: 'Asia/Jerusalem', publicPageStyle: 'BOOKING', landingContent: null,
  },
  settings: {
    minLeadTimeMinutes: 60, cancellationWindowHours: 24, slotGranularityMinutes: 15,
    maxAdvanceBookingDays: 30, bookingRequiresApproval: false, remindersEnabled: false,
    reminderChannel: 'EMAIL', reminderLeadHours: 24, confirmationRequired: false,
    notifyOnBooking: true, notifyOnCancellation: true, pushEnabled: false, onboardingCompleted: true,
  },
  templateOverrides: {},
  onboardingCompleted: true,
  isExclusive: false,
  vapidPublicKey: null,
};

test('settings exposes one usable manual save control before the first edit', () => {
  const $ = load(renderToStaticMarkup(React.createElement(SettingsForm, props)));
  const save = $('form button[type="submit"]');
  assert.equal(save.length, 1);
  assert.equal(save.text(), t.admin.settings.saveAll);
  assert.equal(save.attr('disabled'), undefined);
  assert.ok(save.hasClass('min-h-11'));
  assert.equal(save.parents('.invisible, .pointer-events-none, [hidden]').length, 0);
  assert.equal(save.closest('form').length, 1);
  assert.equal(save.parent().find('[role="status"]').text(), t.admin.settings.manualSaveHint);
  assert.ok(!save.parent().text().includes(t.admin.settings.unsavedHint));
});

test('initial settings never claims acknowledged success or hides manual instructions', () => {
  const $ = load(renderToStaticMarkup(React.createElement(SettingsForm, props)));
  assert.ok(!$.text().includes(t.admin.settings.nextStep.title));
  const status = $('form button[type="submit"]').parent().find('[role="status"]');
  assert.equal(status.text(), t.admin.settings.manualSaveHint);
  assert.equal(status.parents('.invisible, [hidden]').length, 0);
});
