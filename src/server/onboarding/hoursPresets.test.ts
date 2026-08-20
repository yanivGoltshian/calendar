import { test } from 'node:test';
import assert from 'node:assert/strict';

import { workingHoursPreset } from './hoursPresets';

/** כל השורות חייבות להגדיר הפסקות כמערך ריק (ללא הפסקות בברירת המחדל). */
function assertNoBreaks(rows: { breaks: [number, number][] }[]) {
  for (const row of rows) assert.deepEqual(row.breaks, []);
}

test("'sun-thu' מחזיר ראשון–חמישי 09:00–18:00", () => {
  const rows = workingHoursPreset('sun-thu');
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((r) => r.weekday),
    [0, 1, 2, 3, 4],
  );
  for (const row of rows) {
    assert.equal(row.startMinute, 540);
    assert.equal(row.endMinute, 1080);
  }
  assertNoBreaks(rows);
});

test("'every-day' מחזיר את כל השבוע 09:00–20:00", () => {
  const rows = workingHoursPreset('every-day');
  assert.equal(rows.length, 7);
  assert.deepEqual(
    rows.map((r) => r.weekday),
    [0, 1, 2, 3, 4, 5, 6],
  );
  for (const row of rows) {
    assert.equal(row.startMinute, 540);
    assert.equal(row.endMinute, 1200);
  }
  assertNoBreaks(rows);
});

test("'custom' מחזיר ברירת מחדל שמרנית ראשון–חמישי 09:00–17:00", () => {
  const rows = workingHoursPreset('custom');
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((r) => r.weekday),
    [0, 1, 2, 3, 4],
  );
  for (const row of rows) {
    assert.equal(row.startMinute, 540);
    assert.equal(row.endMinute, 1020);
  }
  assertNoBreaks(rows);
});
