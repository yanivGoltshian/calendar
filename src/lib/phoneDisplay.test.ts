// בדיקות יחידה לעיצוב הטלפון לתצוגה.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatIsraeliPhoneDisplay } from './phoneDisplay';

test('נייד מנורמל → 05X-XXX-XXXX', () => {
  assert.equal(formatIsraeliPhoneDisplay('+972546755521'), '054-675-5521');
});

test('קווי מנורמל → 0X-XXX-XXXX', () => {
  assert.equal(formatIsraeliPhoneDisplay('+97236221234'), '03-622-1234');
});

test('קלט לא ישראלי מוחזר כפי שהוא', () => {
  assert.equal(formatIsraeliPhoneDisplay('+15551234567'), '+15551234567');
});

test('כבר מעוצב מקומית — מוחזר כפי שהוא (אין +972)', () => {
  assert.equal(formatIsraeliPhoneDisplay('054-675-5521'), '054-675-5521');
});

test('ריק/undefined → מחרוזת ריקה', () => {
  assert.equal(formatIsraeliPhoneDisplay(''), '');
  assert.equal(formatIsraeliPhoneDisplay(null), '');
  assert.equal(formatIsraeliPhoneDisplay(undefined), '');
});
