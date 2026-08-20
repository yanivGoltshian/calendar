import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCustomHours, workingHoursPreset } from './hoursPresets';

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

test('parseCustomHours: ממיר ימים פתוחים לשורות תקינות וממוין לפי יום', () => {
  const rows = parseCustomHours([
    { weekday: 2, open: true, start: '10:00', end: '16:30' },
    { weekday: 0, open: true, start: '09:00', end: '17:00' },
  ]);
  assert.deepEqual(
    rows.map((r) => r.weekday),
    [0, 2],
  );
  assert.equal(rows[0].startMinute, 540);
  assert.equal(rows[0].endMinute, 1020);
  assert.equal(rows[1].startMinute, 600);
  assert.equal(rows[1].endMinute, 990);
  assertNoBreaks(rows);
});

test('parseCustomHours: מדלג על ימים סגורים, מחוץ לטווח ושעות לא-תקינות', () => {
  const rows = parseCustomHours([
    { weekday: 1, open: false, start: '09:00', end: '17:00' },
    { weekday: 9, open: true, start: '09:00', end: '17:00' },
    { weekday: 3, open: true, start: '18:00', end: '17:00' },
    { weekday: 4, open: true, start: '25:61', end: '17:00' },
    { weekday: 5, open: true, start: '08:00', end: '12:00' },
  ]);
  assert.deepEqual(
    rows.map((r) => r.weekday),
    [5],
  );
  assert.equal(rows[0].startMinute, 480);
  assert.equal(rows[0].endMinute, 720);
});

test('parseCustomHours: קלט ריק מחזיר מערך ריק', () => {
  assert.deepEqual(parseCustomHours([]), []);
});
