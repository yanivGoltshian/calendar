import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSaleDateRange } from './sales';

// כל הבדיקות טהורות וללא DB. הן מוודאות שטווח התאריכים של הקופה נגזר נכון לפי
// שעון העסק (Asia/Jerusalem), עם גבולות מחצה-פתוחים [fromUtc, toUtc) ועם ניקוי
// קלט לא תקין. ערכי ה-UTC משקפים היסט קיץ +3 והיסט חורף +2 בישראל.

test('יום בודד בקיץ: גבול תחתון חצות מקומי, גבול עליון חצות היום שאחרי (בלעדי)', () => {
  const r = buildSaleDateRange('2026-08-19', '2026-08-19');
  assert.equal(r.from, '2026-08-19');
  assert.equal(r.to, '2026-08-19');
  // קיץ בישראל: היסט +3, ולכן חצות מקומי הוא 21:00 ביום הקודם ב-UTC.
  assert.equal(r.fromUtc?.toISOString(), '2026-08-18T21:00:00.000Z');
  // הגבול העליון בלעדי: תחילת היום שאחרי (20.08) בשעון מקומי.
  assert.equal(r.toUtc?.toISOString(), '2026-08-19T21:00:00.000Z');
});

test('יום בודד בחורף: היסט +2', () => {
  const r = buildSaleDateRange('2026-01-15', '2026-01-15');
  // חורף בישראל: היסט +2, ולכן חצות מקומי הוא 22:00 ביום הקודם ב-UTC.
  assert.equal(r.fromUtc?.toISOString(), '2026-01-14T22:00:00.000Z');
  assert.equal(r.toUtc?.toISOString(), '2026-01-15T22:00:00.000Z');
});

test('טווח תקין: הגבול העליון הוא תחילת היום שאחרי עד-תאריך', () => {
  const r = buildSaleDateRange('2026-08-01', '2026-08-31');
  assert.equal(r.from, '2026-08-01');
  assert.equal(r.to, '2026-08-31');
  assert.equal(r.fromUtc?.toISOString(), '2026-07-31T21:00:00.000Z');
  // כולל את 31.08 במלואו: הגבול הוא תחילת 01.09 בשעון מקומי.
  assert.equal(r.toUtc?.toISOString(), '2026-08-31T21:00:00.000Z');
});

test('טווח הפוך מתוקן בהחלפה בין מתאריך לעד-תאריך', () => {
  const r = buildSaleDateRange('2026-08-31', '2026-08-01');
  assert.equal(r.from, '2026-08-01');
  assert.equal(r.to, '2026-08-31');
  assert.equal(r.fromUtc?.toISOString(), '2026-07-31T21:00:00.000Z');
  assert.equal(r.toUtc?.toISOString(), '2026-08-31T21:00:00.000Z');
});

test('מתאריך בלבד: אין גבול עליון', () => {
  const r = buildSaleDateRange('2026-08-19', undefined);
  assert.equal(r.from, '2026-08-19');
  assert.equal(r.to, null);
  assert.equal(r.fromUtc?.toISOString(), '2026-08-18T21:00:00.000Z');
  assert.equal(r.toUtc, null);
});

test('עד-תאריך בלבד: אין גבול תחתון', () => {
  const r = buildSaleDateRange(undefined, '2026-08-19');
  assert.equal(r.from, null);
  assert.equal(r.to, '2026-08-19');
  assert.equal(r.fromUtc, null);
  assert.equal(r.toUtc?.toISOString(), '2026-08-19T21:00:00.000Z');
});

test('ללא קלט: כל הגבולות ריקים (מציג את כל התאריכים)', () => {
  const r = buildSaleDateRange();
  assert.deepEqual(r, { from: null, to: null, fromUtc: null, toUtc: null });
});

test('קלט לא תקין מנוקה בשקט ונחשב כחסר', () => {
  // מבנה שגוי, חודש/יום מחוץ לתחום, אי-ריפוד, תאריך לא אמיתי בלוח, ומחרוזת ריקה.
  assert.equal(buildSaleDateRange('garbage', null).from, null);
  assert.equal(buildSaleDateRange('2026-13-40', null).from, null);
  assert.equal(buildSaleDateRange('2026-2-3', null).from, null);
  assert.equal(buildSaleDateRange('2026-02-30', null).from, null);
  assert.equal(buildSaleDateRange('', '').to, null);
});

test('קלט חלקי תקין נשמר גם כשהצד השני פסול', () => {
  const r = buildSaleDateRange('2026-08-19', 'nope');
  assert.equal(r.from, '2026-08-19');
  assert.equal(r.to, null);
  assert.equal(r.toUtc, null);
});
