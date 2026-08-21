import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCountdown, resolveEndTime } from './launchOffer';

test('resolveEndTime: תאריך בלבד נחשב לסוף היום ב-UTC', () => {
  assert.equal(resolveEndTime('2026-08-31'), Date.parse('2026-08-31T23:59:59.999Z'));
});

test('resolveEndTime: מחזיר NaN לקלט לא תקין', () => {
  assert.ok(Number.isNaN(resolveEndTime('not-a-date')));
  assert.ok(Number.isNaN(resolveEndTime('')));
});

test('computeCountdown: מפרק נכון את הזמן שנותר', () => {
  const now = Date.parse('2026-08-30T23:59:59.999Z');
  const c = computeCountdown('2026-08-31', now);
  assert.equal(c.expired, false);
  assert.equal(c.days, 1);
  assert.equal(c.hours, 0);
  assert.equal(c.minutes, 0);
  assert.equal(c.seconds, 0);
  assert.equal(c.totalMs, 86400000);
});

test('computeCountdown: מפרק שעות/דקות/שניות בשארית', () => {
  const end = Date.parse('2026-01-02T00:00:00.000Z');
  const now = end - ((2 * 3600 + 3 * 60 + 4) * 1000);
  const c = computeCountdown('2026-01-02T00:00:00.000Z', now);
  assert.equal(c.days, 0);
  assert.equal(c.hours, 2);
  assert.equal(c.minutes, 3);
  assert.equal(c.seconds, 4);
});

test('computeCountdown: מצב הסתיים כשהזמן חלף או שווה', () => {
  const end = Date.parse('2020-01-01T00:00:00.000Z');
  const c = computeCountdown('2020-01-01T00:00:00.000Z', end + 1000);
  assert.deepEqual(c, { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  const exact = computeCountdown('2020-01-01T00:00:00.000Z', end);
  assert.equal(exact.expired, true);
});

test('computeCountdown: קלט לא תקין נחשב כהסתיים', () => {
  assert.equal(computeCountdown('bad', 0).expired, true);
});
