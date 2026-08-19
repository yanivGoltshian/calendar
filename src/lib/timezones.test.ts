import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TIMEZONE,
  FALLBACK_TIMEZONES,
  filterTimezoneOptions,
  getTimezoneOptions,
  labelForTimezone,
  normalizeForSearch,
  type TimezoneOption,
} from './timezones';

/** מאתר אפשרות לפי מזהה IANA בתוך רשימת תוצאות. */
function ids(options: readonly TimezoneOption[]): string[] {
  return options.map((o) => o.id);
}

test('DEFAULT_TIMEZONE הוא Asia/Jerusalem ונמצא בגיבוי', () => {
  assert.equal(DEFAULT_TIMEZONE, 'Asia/Jerusalem');
  assert.ok(FALLBACK_TIMEZONES.includes('Asia/Jerusalem'));
});

test('labelForTimezone: תווית עברית מלאה לישראל ולאזורים נפוצים', () => {
  assert.equal(labelForTimezone('Asia/Jerusalem'), 'ישראל (ירושלים)');
  assert.equal(labelForTimezone('America/New_York'), 'ארצות הברית (ניו יורק)');
  assert.equal(labelForTimezone('UTC'), 'זמן אוניברסלי מתואם (UTC)');
});

test('labelForTimezone: זנב ארוך נופל לשם העיר מהמזהה', () => {
  // אזור לא ממופה, נגזרת שם העיר, וקו תחתון הופך לרווח.
  assert.equal(labelForTimezone('Antarctica/South_Pole'), 'South Pole');
});

test('getTimezoneOptions: ייחודי, כולל ברירת מחדל, וישראל בראש', () => {
  const options = getTimezoneOptions();
  assert.ok(options.length > 0);
  // ישראל בראש הרשימה כברירת מחדל.
  assert.equal(options[0].id, DEFAULT_TIMEZONE);
  // כולל את ברירת המחדל.
  assert.ok(ids(options).includes(DEFAULT_TIMEZONE));
  // ייחודי לפי מזהה.
  assert.equal(new Set(ids(options)).size, options.length);
  // לכל אפשרות יש מזהה ותווית לא ריקה.
  for (const opt of options) {
    assert.ok(opt.id.length > 0);
    assert.ok(opt.label.length > 0);
  }
});

test('filterTimezoneOptions: שאילתה ריקה מחזירה רשימת ברירת מחדל עם ישראל בראש', () => {
  const options = getTimezoneOptions();
  const empty = filterTimezoneOptions(options, '');
  const spaces = filterTimezoneOptions(options, '   ');
  assert.deepEqual(ids(empty), ids(options));
  assert.deepEqual(ids(spaces), ids(options));
  // ישראל נוכחת ובראש.
  assert.equal(empty[0].id, DEFAULT_TIMEZONE);
  assert.ok(ids(empty).includes('Asia/Jerusalem'));
});

test("filterTimezoneOptions: 'Israel' על כל צורותיו מוביל ל-Asia/Jerusalem", () => {
  const options = getTimezoneOptions();
  for (const q of ['Israel', 'israel', 'ISRAEL', 'IsraEL']) {
    const res = filterTimezoneOptions(options, q);
    assert.equal(res[0]?.id, 'Asia/Jerusalem', `שאילתה: ${q}`);
  }
});

test('filterTimezoneOptions: חיפוש בעברית מוביל ל-Asia/Jerusalem', () => {
  const options = getTimezoneOptions();
  for (const q of ['ישראל', 'ירושלים', 'אזור זמן']) {
    const res = filterTimezoneOptions(options, q);
    assert.equal(res[0]?.id, 'Asia/Jerusalem', `שאילתה: ${q}`);
  }
});

test("filterTimezoneOptions: מילים נרדפות 'Jerusalem', 'IL', 'jer' מובילות לישראל", () => {
  const options = getTimezoneOptions();
  for (const q of ['Jerusalem', 'jerusalem', 'IL', 'il', 'jer']) {
    const res = filterTimezoneOptions(options, q);
    assert.equal(res[0]?.id, 'Asia/Jerusalem', `שאילתה: ${q}`);
  }
});

test('filterTimezoneOptions: חסר רגישות לניקוד עברי', () => {
  const options = getTimezoneOptions();
  // יִשְׂרָאֵל עם ניקוד מלא, חייב להתאים.
  const res = filterTimezoneOptions(options, 'יִשְׂרָאֵל');
  assert.equal(res[0]?.id, 'Asia/Jerusalem');
});

test('filterTimezoneOptions: התאמה מול המזהה הלועזי (new york)', () => {
  const options = getTimezoneOptions();
  const res = filterTimezoneOptions(options, 'new york');
  assert.ok(ids(res).includes('America/New_York'));
});

test('filterTimezoneOptions: התאמה מול תווית עברית (ברזיל)', () => {
  const options = getTimezoneOptions();
  const res = filterTimezoneOptions(options, 'ברזיל');
  assert.ok(ids(res).includes('America/Sao_Paulo'));
});

test('filterTimezoneOptions: מדרג התאמות־תחילה לפני התאמות־אמצע', () => {
  const sample: TimezoneOption[] = [
    { id: 'zone/contains', label: 'אא match בב' },
    { id: 'match/zone', label: 'זזז' },
  ];
  // 'match' מתחיל את התווית/המזהה של השני, ומופיע באמצע של הראשון.
  const res = filterTimezoneOptions(sample, 'match');
  assert.deepEqual(ids(res), ['match/zone', 'zone/contains']);
});

test('filterTimezoneOptions: אין התאמות ⇐ מערך ריק', () => {
  const options = getTimezoneOptions();
  assert.deepEqual(filterTimezoneOptions(options, 'zzzzz'), []);
});

test('normalizeForSearch: מוריד רישיות, ניקוד, פיסוק ומאחד מפרידים', () => {
  assert.equal(normalizeForSearch('  Asia/Jerusalem  '), 'asia jerusalem');
  assert.equal(normalizeForSearch('New_York'), 'new york');
  assert.equal(normalizeForSearch('יִשְׂרָאֵל'), 'ישראל');
  // גרש וסוגריים מוסרים כדי שהחיפוש יתאים עם או בלעדיהם.
  assert.equal(normalizeForSearch('ישראל (ירושלים)'), 'ישראל ירושלים');
});
