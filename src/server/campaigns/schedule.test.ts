import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isCampaignDue, type SchedulableCampaign } from './schedule';

const NOW = new Date('2026-01-15T12:00:00.000Z');

function campaign(overrides: Partial<SchedulableCampaign>): SchedulableCampaign {
  return { status: 'SCHEDULED', scheduledAt: new Date('2026-01-15T11:00:00.000Z'), ...overrides };
}

test('isCampaignDue — SCHEDULED שזמנו חלף בשל', () => {
  assert.equal(isCampaignDue(campaign({}), NOW), true);
});

test('isCampaignDue — SCHEDULED שזמנו בדיוק עכשיו בשל', () => {
  assert.equal(isCampaignDue(campaign({ scheduledAt: new Date(NOW) }), NOW), true);
});

test('isCampaignDue — SCHEDULED שזמנו בעתיד אינו בשל', () => {
  assert.equal(
    isCampaignDue(campaign({ scheduledAt: new Date('2026-01-15T12:00:00.001Z') }), NOW),
    false,
  );
});

test('isCampaignDue — SCHEDULED ללא scheduledAt אינו בשל', () => {
  assert.equal(isCampaignDue(campaign({ scheduledAt: null }), NOW), false);
});

test('isCampaignDue — סטטוסים אחרים לעולם אינם בשלים', () => {
  for (const status of ['DRAFT', 'SENDING', 'SENT', 'FAILED']) {
    assert.equal(
      isCampaignDue(campaign({ status, scheduledAt: new Date('2026-01-01T00:00:00.000Z') }), NOW),
      false,
      `סטטוס ${status} לא אמור להיות בשל`,
    );
  }
});
