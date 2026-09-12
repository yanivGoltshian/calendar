import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  exceptionMatches, normalizeException, resolveExceptionHours, fromHebrewDate,
  toHebrewDate, MAX_EXCEPTION_RULES, type ExceptionInput,
} from './workingHoursExceptions';
import { computeSlots, intervalFitsWorkingHours } from '@/server/availability';

const input: ExceptionInput = {
  title: 'Vacation', staffId: null, start: { calendar: 'GREGORIAN', date: '2026-09-14' },
  recurrence: 'ONCE', closed: true, startMinute: null, endMinute: null,
};
const regular = [{ weekday: 1, startMinute: 540, endMinute: 1020, breaks: [] as [number, number][] }];

test('inclusive one-off range expires without recurrence expansion', () => {
  const rule = normalizeException({ ...input, end: { calendar: 'GREGORIAN', date: '2026-09-16' } });
  assert.equal(exceptionMatches(rule, '2026-09-13'), false);
  for (const date of ['2026-09-14', '2026-09-15', '2026-09-16']) assert.equal(exceptionMatches(rule, date), true);
  assert.equal(exceptionMatches(rule, '2026-09-17'), false);
});

test('fortnightly is anchored to its first Monday, with inclusive bounds', () => {
  const rule = normalizeException({ ...input, recurrence: 'WEEKLY', intervalWeeks: 2, until: '2026-10-12' });
  for (const date of ['2026-09-14', '2026-09-28', '2026-10-12']) assert.equal(exceptionMatches(rule, date), true);
  for (const date of ['2026-09-07', '2026-09-21', '2026-09-29', '2026-10-26']) assert.equal(exceptionMatches(rule, date), false);
});

test('ICU Hebrew conversion round-trips Rosh Hashanah and annual Hebrew dates', () => {
  assert.equal(fromHebrewDate(5787, 'TISHRI', 1), '2026-09-12');
  assert.deepEqual(toHebrewDate('2026-09-12'), { year: 5787, month: 'TISHRI', day: 1 });
  const rule = normalizeException({ ...input, start: { calendar: 'HEBREW', year: 5787, month: 'TISHRI', day: 1 }, recurrence: 'ANNUAL' });
  assert.equal(exceptionMatches(rule, '2027-10-02'), true);
  assert.equal(exceptionMatches(rule, '2027-09-12'), false);
  assert.equal(exceptionMatches(rule, '2027-10-03'), false);
});

test('generic Adar follows final Adar and explicit leap months skip common years', () => {
  const generic = normalizeException({ ...input, start: { calendar: 'HEBREW', year: 5786, month: 'ADAR', day: 14 }, recurrence: 'ANNUAL' });
  const leapFinal = fromHebrewDate(5787, 'ADAR_II', 14);
  const leapFirst = fromHebrewDate(5787, 'ADAR_I', 14);
  assert.equal(exceptionMatches(generic, leapFinal), true);
  assert.equal(exceptionMatches(generic, leapFirst), false);
  const explicit = normalizeException({ ...input, start: { calendar: 'HEBREW', year: 5787, month: 'ADAR_I', day: 14 }, recurrence: 'ANNUAL' });
  assert.equal(exceptionMatches(explicit, fromHebrewDate(5788, 'ADAR', 14)), false);
  assert.throws(() => fromHebrewDate(5788, 'ADAR_I', 14), /invalid_date/);
});

test('missing annual dates skip the year without rolling to another date', () => {
  const leapDay = normalizeException({ ...input, start: { calendar: 'GREGORIAN', date: '2024-02-29' }, recurrence: 'ANNUAL' });
  assert.equal(exceptionMatches(leapDay, '2025-02-28'), false);
  assert.equal(exceptionMatches(leapDay, '2025-03-01'), false);
  assert.equal(exceptionMatches(leapDay, '2028-02-29'), true);
  const kislev = normalizeException({ ...input, start: { calendar: 'HEBREW', year: 5785, month: 'KISLEV', day: 30 }, recurrence: 'ANNUAL' });
  assert.equal(exceptionMatches(kislev, fromHebrewDate(5787, 'TEVET', 1)), false);
});

test('invalid dates, oversized ranges, incoherent fields and unbounded rule work reject', () => {
  for (const patch of [
    { start: { calendar: 'GREGORIAN', date: '2026-02-30' } },
    { end: { calendar: 'GREGORIAN', date: '2026-09-13' } },
    { end: { calendar: 'GREGORIAN', date: '2027-09-15' } },
    { recurrence: 'ANNUAL', end: { calendar: 'GREGORIAN', date: '2026-09-15' } },
    { recurrence: 'WEEKLY', intervalWeeks: 0 }, { recurrence: 'WEEKLY', intervalWeeks: 53 },
    { recurrence: 'WEEKLY', until: '2026-09-13' },
    { recurrence: 'WEEKLY', until: '2100-01-01' },
    { until: '2026-12-01' },
    { closed: false, startMinute: 600, endMinute: 500 },
    { startMinute: 600 }, { title: 'x'.repeat(101) },
  ]) assert.throws(() => normalizeException({ ...input, ...patch }));
  assert.throws(() => resolveExceptionHours(regular,
    Array(MAX_EXCEPTION_RULES + 1).fill(normalizeException(input)), 'staff', '2026-09-14'), /exception_limit/);
});

test('closure wins; alternatives intersect; staff cannot reopen business closure', () => {
  const closed = normalizeException(input);
  const alternative = normalizeException({ ...input, closed: false, startMinute: 600, endMinute: 900 });
  const staff = normalizeException({ ...input, staffId: 'staff', closed: false, startMinute: 800, endMinute: 1100 });
  assert.deepEqual(resolveExceptionHours(regular, [], 'staff', '2026-09-14'), regular);
  assert.deepEqual(resolveExceptionHours(regular, [closed, staff], 'staff', '2026-09-14'), []);
  assert.deepEqual(resolveExceptionHours(regular, [staff, closed], 'staff', '2026-09-14'), []);
  for (const rules of [[staff, alternative], [alternative, staff]]) {
    assert.deepEqual(resolveExceptionHours(regular, rules, 'staff', '2026-09-14'),
      [{ weekday: 1, startMinute: 800, endMinute: 900, breaks: [] }]);
  }
  assert.deepEqual(resolveExceptionHours(regular, [staff], 'other', '2026-09-14'), regular);
  const longer = { ...alternative, startMinute: 300, endMinute: 1200 };
  assert.equal(resolveExceptionHours(regular, [longer], 'staff', '2026-09-14')[0].startMinute, 300);
  assert.equal(resolveExceptionHours(regular, [longer], 'staff', '2026-09-14', false)[0].startMinute, 540);
});

test('DST gap slots never alias earlier times, and durations fit actual UTC closing', () => {
  for (const [date, zone] of [['2026-03-27', 'Asia/Jerusalem'], ['2026-03-08', 'America/New_York']]) {
    const hours = [{ weekday: new Date(`${date}T12:00:00Z`).getUTCDay(), startMinute: 60, endMinute: 240, breaks: [] }];
    const slots = computeSlots({ dateStr: date, timeZone: zone, workingHours: hours, busy: [],
      durationMin: 30, slotGranularityMin: 30, now: new Date('2026-01-01T00:00:00Z') });
    assert.equal(new Set(slots.map((slot) => slot.startAtUtc)).size, slots.length);
    for (const slot of slots) assert.equal(intervalFitsWorkingHours(
      new Date(slot.startAtUtc), new Date(slot.endAtUtc), date, hours, zone), true);
  }
  const date = '2026-11-01';
  const hours = [{ weekday: 0, startMinute: 60, endMinute: 120, breaks: [] }];
  const slots = computeSlots({ dateStr: date, timeZone: 'America/New_York', workingHours: hours, busy: [],
    durationMin: 30, slotGranularityMin: 30, now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(slots[0].startAtUtc, '2026-11-01T05:00:00.000Z');
  assert.equal(intervalFitsWorkingHours(new Date('2026-11-01T05:30:00Z'), new Date('2026-11-01T07:30:00Z'),
    date, hours, 'America/New_York'), false);
  const long = computeSlots({ dateStr: date, timeZone: 'America/New_York', workingHours: hours, busy: [],
    durationMin: 90, slotGranularityMin: 30, now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(long.some((slot) => slot.startAtUtc === '2026-11-01T05:30:00.000Z' &&
    slot.endAtUtc === '2026-11-01T07:00:00.000Z'), true);
  const secondHourBusy = computeSlots({ dateStr: date, timeZone: 'America/New_York', workingHours: hours,
    busy: [{ startAt: new Date('2026-11-01T06:00:00Z'), endAt: new Date('2026-11-01T06:30:00Z') }],
    durationMin: 30, slotGranularityMin: 30, now: new Date('2026-01-01T00:00:00Z') });
  assert.equal(secondHourBusy.some((slot) => slot.startAtUtc === '2026-11-01T05:00:00.000Z'), true);
});
