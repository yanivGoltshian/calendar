import assert from 'node:assert/strict';
import { test } from 'node:test';
import { utcToLocalParts } from '@/lib/time';
import { parseCampaignScheduledAt } from './schedule';

const TZ = 'Asia/Jerusalem';

test('campaign wall time uses Israeli winter and summer offsets independently of the host timezone', () => {
  assert.equal(
    parseCampaignScheduledAt('2027-01-15T12:30', TZ)?.toISOString(),
    '2027-01-15T10:30:00.000Z',
  );
  assert.equal(
    parseCampaignScheduledAt('2027-07-15T12:30', TZ)?.toISOString(),
    '2027-07-15T09:30:00.000Z',
  );
  assert.equal(
    parseCampaignScheduledAt('2028-02-29T00:00', TZ)?.toISOString(),
    '2028-02-28T22:00:00.000Z',
  );
});

test('campaign scheduling rejects malformed input and impossible calendar dates', () => {
  for (const input of [
    '',
    '2027-02-29T12:30',
    '2027-02-31T12:30',
    '2027-04-31T12:30',
    '2027-00-01T12:30',
    '2027-13-01T12:30',
    '2027-01-00T12:30',
    '2027-01-01T24:00',
    '2027-01-01T12:60',
    '2027-01-01',
    '2027-01-01T12:30Z',
    '2027-01-01T12:30:00',
    '0000-01-01T12:30',
  ]) {
    assert.equal(parseCampaignScheduledAt(input, TZ), null, input);
  }
});

test('campaign scheduling rejects the Israeli spring DST gap while accepting its boundaries', () => {
  assert.equal(
    parseCampaignScheduledAt('2027-03-26T01:59', TZ)?.toISOString(),
    '2027-03-25T23:59:00.000Z',
  );
  assert.equal(parseCampaignScheduledAt('2027-03-26T02:00', TZ), null);
  assert.equal(parseCampaignScheduledAt('2027-03-26T02:30', TZ), null);
  assert.equal(parseCampaignScheduledAt('2027-03-26T02:59', TZ), null);
  assert.equal(
    parseCampaignScheduledAt('2027-03-26T03:00', TZ)?.toISOString(),
    '2027-03-26T00:00:00.000Z',
  );
});

test('campaign scheduling selects one deterministic instant during the autumn overlap', () => {
  const instant = parseCampaignScheduledAt('2026-10-25T01:30', TZ);
  assert.ok(instant);
  assert.equal(instant.toISOString(), '2026-10-24T23:30:00.000Z');
  assert.deepEqual(utcToLocalParts(instant, TZ), {
    year: 2026,
    month1: 10,
    day: 25,
    minutes: 90,
    weekday: 0,
  });
});
