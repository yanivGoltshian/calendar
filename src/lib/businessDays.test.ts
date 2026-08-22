import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addBusinessDays,
  addFourteenBusinessDays,
  isIsraeliWeekend,
} from './businessDays';

// עוגנים בחצות UTC: בחורף אזור הזמן בישראל הוא UTC+2, ולכן חצות UTC נופל על
// 02:00 באותו תאריך לוח בירושלים. כך תאריך הלוח הישראלי שווה לתאריך ה-UTC.
const ymd = (date: Date): string => date.toISOString().slice(0, 10);
const at = (isoDate: string): Date => new Date(`${isoDate}T00:00:00Z`);

test('isIsraeliWeekend: שישי ושבת הם סוף שבוע, ראשון עד חמישי אינם', () => {
  assert.equal(isIsraeliWeekend(at('2026-01-01')), false); // חמישי
  assert.equal(isIsraeliWeekend(at('2026-01-02')), true); // שישי
  assert.equal(isIsraeliWeekend(at('2026-01-03')), true); // שבת
  assert.equal(isIsraeliWeekend(at('2026-01-04')), false); // ראשון
});

test('addBusinessDays: יום עסקים אחד מחמישי מדלג שישי/שבת ונוחת בראשון', () => {
  assert.equal(ymd(addBusinessDays(at('2026-01-01'), 1)), '2026-01-04');
});

test('addBusinessDays: שני ימי עסקים מחמישי → שני', () => {
  assert.equal(ymd(addBusinessDays(at('2026-01-01'), 2)), '2026-01-05');
});

test('addBusinessDays: התחלה בשישי מדלגת על שבת', () => {
  assert.equal(ymd(addBusinessDays(at('2026-01-02'), 1)), '2026-01-04');
});

test('addBusinessDays: חמישה ימי עסקים מראשון חוצים סוף שבוע אחד', () => {
  assert.equal(ymd(addBusinessDays(at('2026-01-04'), 5)), '2026-01-11');
});

test('addBusinessDays: 14 ימי עסקים מחמישי חוצים שני סופי שבוע', () => {
  assert.equal(ymd(addBusinessDays(at('2026-01-01'), 14)), '2026-01-21');
});

test('addBusinessDays: אפס ומספר שלילי מחזירים את תאריך ההתחלה עצמו', () => {
  assert.equal(ymd(addBusinessDays(at('2026-01-01'), 0)), '2026-01-01');
  assert.equal(ymd(addBusinessDays(at('2026-01-01'), -3)), '2026-01-01');
});

test('addFourteenBusinessDays: תוצאה לעולם אינה נופלת על שישי או שבת', () => {
  // דגימה לאורך שנה: מועד המחיקה המחושב תמיד יום עסקים.
  const base = at('2026-01-01');
  for (let offset = 0; offset < 365; offset += 1) {
    const start = new Date(base.getTime() + offset * 24 * 60 * 60 * 1000);
    const purge = addFourteenBusinessDays(start);
    assert.equal(
      isIsraeliWeekend(purge),
      false,
      `מועד המחיקה עבור ${ymd(start)} נפל על סוף שבוע: ${ymd(purge)}`,
    );
  }
});
