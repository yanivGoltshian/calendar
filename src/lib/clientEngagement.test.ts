import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLIENT_SEGMENTS, engagementTags, isClientSegment } from './clientEngagement';

test('engagement tags overlap and the returning threshold is four bookings', () => {
  assert.deepEqual(engagementTags({ bookingCount: 3, recentBooking: false, quarterBooking: true, visited: true }), []);
  assert.deepEqual(engagementTags({ bookingCount: 4, recentBooking: true, quarterBooking: true, visited: true }),
    ['recent_bookers', 'returning']);
  assert.deepEqual(engagementTags({ bookingCount: 4, recentBooking: false, quarterBooking: false, visited: true }),
    ['returning', 'past_clients']);
  assert.deepEqual(engagementTags({ bookingCount: 1, recentBooking: false, quarterBooking: false, visited: false }), []);
});

test('client segment validation accepts only the shared campaign categories', () => {
  for (const segment of CLIENT_SEGMENTS) assert.equal(isClientSegment(segment), true);
  for (const value of [null, undefined, '', 'RECENT_BOOKERS', 'blocked', 4, {}]) {
    assert.equal(isClientSegment(value), false);
  }
});
