import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeBreakIntervals,
  normalizeStoredWorkingHours,
  normalizeWorkingHoursRows,
  WorkingHoursValidationError,
} from './workingHours';

test('working-hour normalization sorts days and every break while preserving adjacency', () => {
  assert.deepEqual(normalizeWorkingHoursRows([
    {
      weekday: 3,
      startMinute: 540,
      endMinute: 1080,
      breaks: [[900, 930], [720, 750], [750, 780]],
    },
    { weekday: 1, startMinute: 600, endMinute: 900, breaks: [] },
  ]), [
    { weekday: 1, startMinute: 600, endMinute: 900, breaks: [] },
    {
      weekday: 3,
      startMinute: 540,
      endMinute: 1080,
      breaks: [[720, 750], [750, 780], [900, 930]],
    },
  ]);
});

test('working-hour normalization rejects malformed, out-of-range and overlapping breaks', () => {
  const invalid: Array<{ value: unknown; code: string }> = [
    { value: [[720]], code: 'break' },
    { value: [['720', 750]], code: 'break' },
    { value: [[720, 720]], code: 'break' },
    { value: [[500, 600]], code: 'break' },
    { value: [[720, 780], [750, 810]], code: 'break_overlap' },
    { value: [[720, 780], [720, 780]], code: 'break_overlap' },
  ];
  for (const { value, code } of invalid) {
    assert.throws(
      () => normalizeBreakIntervals(value, 540, 1020),
      (error) => error instanceof WorkingHoursValidationError && error.code === code,
    );
  }
});

test('stored break JSON is decoded and sorted without changing the surrounding row', () => {
  const createdAt = new Date('2026-09-13T00:00:00Z');
  assert.deepEqual(normalizeStoredWorkingHours([{
    id: 'hours-1',
    weekday: 2,
    startMinute: 540,
    endMinute: 1020,
    breaks: [[900, 930], [720, 750]],
    createdAt,
  }]), [{
    id: 'hours-1',
    weekday: 2,
    startMinute: 540,
    endMinute: 1020,
    breaks: [[720, 750], [900, 930]],
    createdAt,
  }]);
});
