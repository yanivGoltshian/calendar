import assert from 'node:assert/strict';
import { test } from 'node:test';

import { matchesFreedSlot, rankWaitlistMatches, type FreedSlot, type WaitlistCandidate } from './match';

function candidate(overrides: Partial<WaitlistCandidate> = {}): WaitlistCandidate {
  return {
    id: 'w1',
    serviceId: null,
    staffId: null,
    desiredDate: null,
    earliestMinute: null,
    latestMinute: null,
    status: 'WAITING',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function slot(overrides: Partial<FreedSlot> = {}): FreedSlot {
  return {
    serviceIds: ['svc-a'],
    staffId: 'staff-1',
    dateStr: '2026-02-10',
    startMinute: 600, // 10:00
    endMinute: 660,
    ...overrides,
  };
}

test('open entry (no preferences) matches any slot', () => {
  assert.equal(matchesFreedSlot(candidate(), slot()), true);
});

test('non-WAITING statuses are never eligible', () => {
  for (const status of ['NOTIFIED', 'BOOKED', 'EXPIRED', 'CANCELLED']) {
    assert.equal(matchesFreedSlot(candidate({ status }), slot()), false, status);
  }
});

test('service must be among the freed appointment services', () => {
  assert.equal(matchesFreedSlot(candidate({ serviceId: 'svc-a' }), slot({ serviceIds: ['svc-a', 'svc-b'] })), true);
  assert.equal(matchesFreedSlot(candidate({ serviceId: 'svc-c' }), slot({ serviceIds: ['svc-a', 'svc-b'] })), false);
});

test('staff preference is enforced only when set', () => {
  assert.equal(matchesFreedSlot(candidate({ staffId: 'staff-1' }), slot({ staffId: 'staff-1' })), true);
  assert.equal(matchesFreedSlot(candidate({ staffId: 'staff-2' }), slot({ staffId: 'staff-1' })), false);
  // no staff preference → matches any staff
  assert.equal(matchesFreedSlot(candidate({ staffId: null }), slot({ staffId: 'staff-9' })), true);
});

test('desired date is enforced only when set', () => {
  assert.equal(matchesFreedSlot(candidate({ desiredDate: '2026-02-10' }), slot({ dateStr: '2026-02-10' })), true);
  assert.equal(matchesFreedSlot(candidate({ desiredDate: '2026-02-11' }), slot({ dateStr: '2026-02-10' })), false);
  assert.equal(matchesFreedSlot(candidate({ desiredDate: null }), slot({ dateStr: '2026-02-10' })), true);
});

test('time window: slot start must fall inside [earliest, latest]', () => {
  // "morning" window 08:00–12:00
  const morning = candidate({ earliestMinute: 480, latestMinute: 720 });
  assert.equal(matchesFreedSlot(morning, slot({ startMinute: 600 })), true); // 10:00
  assert.equal(matchesFreedSlot(morning, slot({ startMinute: 720 })), true); // 12:00 boundary
  assert.equal(matchesFreedSlot(morning, slot({ startMinute: 480 })), true); // 08:00 boundary
  assert.equal(matchesFreedSlot(morning, slot({ startMinute: 780 })), false); // 13:00 too late
  assert.equal(matchesFreedSlot(morning, slot({ startMinute: 420 })), false); // 07:00 too early
});

test('time window: open-ended bounds', () => {
  assert.equal(matchesFreedSlot(candidate({ earliestMinute: 600, latestMinute: null }), slot({ startMinute: 900 })), true);
  assert.equal(matchesFreedSlot(candidate({ earliestMinute: 600, latestMinute: null }), slot({ startMinute: 540 })), false);
  assert.equal(matchesFreedSlot(candidate({ earliestMinute: null, latestMinute: 720 }), slot({ startMinute: 540 })), true);
  assert.equal(matchesFreedSlot(candidate({ earliestMinute: null, latestMinute: 720 }), slot({ startMinute: 900 })), false);
});

test('rankWaitlistMatches orders eligible entries FCFS by createdAt', () => {
  const older = candidate({ id: 'older', createdAt: new Date('2026-01-01T08:00:00Z') });
  const newer = candidate({ id: 'newer', createdAt: new Date('2026-01-02T08:00:00Z') });
  const wrongService = candidate({ id: 'nope', serviceId: 'svc-z', createdAt: new Date('2026-01-01T00:00:00Z') });
  const ranked = rankWaitlistMatches([newer, wrongService, older], slot());
  assert.deepEqual(ranked.map((e) => e.id), ['older', 'newer']);
});

test('rankWaitlistMatches breaks createdAt ties deterministically by id', () => {
  const t = new Date('2026-01-01T00:00:00Z');
  const b = candidate({ id: 'b', createdAt: t });
  const a = candidate({ id: 'a', createdAt: t });
  const ranked = rankWaitlistMatches([b, a], slot());
  assert.deepEqual(ranked.map((e) => e.id), ['a', 'b']);
});

test('rankWaitlistMatches returns empty when nothing matches', () => {
  const ranked = rankWaitlistMatches([candidate({ serviceId: 'svc-z' })], slot());
  assert.deepEqual(ranked, []);
});
