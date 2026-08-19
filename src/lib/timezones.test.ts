import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterTimezones,
  getTimezones,
  DEFAULT_TIMEZONE,
  FALLBACK_TIMEZONES,
} from './timezones';

const SAMPLE = [
  'Asia/Jerusalem',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'UTC',
];

test('filterTimezones: מחזיר את כל הרשימה על שאילתה ריקה', () => {
  assert.deepEqual(filterTimezones(SAMPLE, ''), SAMPLE);
  assert.deepEqual(filterTimezones(SAMPLE, '   '), SAMPLE);
});

test('filterTimezones: התאמת תת-מחרוזת חסרת רישיות', () => {
  assert.deepEqual(filterTimezones(SAMPLE, 'jer'), ['Asia/Jerusalem']);
  assert.deepEqual(filterTimezones(SAMPLE, 'LONDON'), ['Europe/London']);
});

test('filterTimezones: עמיד ל-_ ול-/ (רווח מתאים למפריד)', () => {
  assert.deepEqual(filterTimezones(SAMPLE, 'new york'), ['America/New_York']);
  assert.deepEqual(filterTimezones(SAMPLE, 'europe/ber'), ['Europe/Berlin']);
});

test('filterTimezones: מדרג התאמות־תחילה לפני התאמות־אמצע', () => {
  // "ind" בתחילת "Indian/Maldives", אך באמצע "America/Indiana/…"
  const list = ['America/Indiana/Indianapolis', 'Indian/Maldives'];
  const res = filterTimezones(list, 'ind');
  assert.deepEqual(res, ['Indian/Maldives', 'America/Indiana/Indianapolis']);
});

test('filterTimezones: אין התאמות ⇐ מערך ריק', () => {
  assert.deepEqual(filterTimezones(SAMPLE, 'zzz'), []);
});

test('getTimezones: ממוין, ייחודי וכולל את ברירת המחדל', () => {
  const list = getTimezones();
  assert.ok(list.length > 0);
  assert.ok(list.includes(DEFAULT_TIMEZONE));
  // ייחודי
  assert.equal(new Set(list).size, list.length);
  // ממוין
  const sorted = [...list].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(list, sorted);
});

test('DEFAULT_TIMEZONE הוא Asia/Jerusalem ונמצא בגיבוי', () => {
  assert.equal(DEFAULT_TIMEZONE, 'Asia/Jerusalem');
  assert.ok(FALLBACK_TIMEZONES.includes('Asia/Jerusalem'));
});
