import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessDate, nextBusinessMidnight } from './businessDate';
import { bookingContactFeedback } from './bookingContactFeedback';
import { isPubliclyListed, shouldShowDirectoryLink } from './directory';
import { buildMetadata } from './seo';
import { BRAND } from '@/config/brand';

test('business day uses Jerusalem midnight rather than browser/UTC date', () => {
  const before = new Date('2026-09-06T20:59:59Z');
  assert.equal(businessDate(before, 'Asia/Jerusalem'), '2026-09-06');
  assert.equal(nextBusinessMidnight(before, 'Asia/Jerusalem').toISOString(), '2026-09-06T21:00:00.000Z');
  assert.equal(businessDate(new Date('2026-09-06T21:00:00Z'), 'Asia/Jerusalem'), '2026-09-07');
  for (const date of ['2026-03-26T22:00:00Z', '2026-10-24T22:00:00Z']) {
    const now = new Date(date);
    const next = nextBusinessMidnight(now, 'Asia/Jerusalem');
    assert.ok(next > now);
    assert.ok(next.getTime() - now.getTime() <= 26 * 3600_000);
    assert.notEqual(businessDate(now, 'Asia/Jerusalem'), businessDate(next, 'Asia/Jerusalem'));
  }
});

test('booking feedback rejects malformed contacts before enabling submit', () => {
  assert.equal(bookingContactFeedback('אורח', 'abc', 'x@', true).valid, false);
  assert.equal(bookingContactFeedback('אורח', '0501234567', '', true).valid, false);
  assert.equal(bookingContactFeedback('אורח', '050-1234567', '', false).valid, true);
  assert.equal(bookingContactFeedback('אורח', '+972501234567', 'test@example.com', true).valid, true);
});

test('one directory gate requires approval, completed onboarding, active lifecycle and entitlement', () => {
  const now = new Date('2026-09-06T12:00:00Z');
  const valid = { slug: 'real-business', listed: true, accountStatus: 'ACTIVE', plan: 'premium',
    paidUntil: new Date('2026-10-01'), settings: { onboardingCompleted: true } };
  assert.equal(isPubliclyListed(valid, now), true);
  for (const override of [{ listed: false }, { listed: undefined }, { accountStatus: 'PENDING_DELETION' },
    { paidUntil: new Date('2026-09-01') }, { settings: null }, { slug: 'esek-2' }]) {
    assert.equal(isPubliclyListed({ ...valid, ...override }, now), false);
  }
  for (const count of [0, 1, 2, NaN, Infinity, -1]) assert.equal(shouldShowDirectoryLink(count), false);
  assert.equal(shouldShowDirectoryLink(3), true);
});

test('auth/quote/booking canonicals strip query variants and platform title is not duplicated', () => {
  for (const path of ['/login', '/business/login', '/business/new', '/quote', '/b/fixture/book']) {
    const metadata = buildMetadata({ title: `בדיקה · ${BRAND.name}`, path: `${path}?next=%2Faccount#section`, noIndex: true });
    assert.equal(metadata.title, 'בדיקה');
    assert.ok(String(metadata.alternates?.canonical).endsWith(path));
    assert.deepEqual(metadata.robots, { index: false, follow: false });
  }
});
