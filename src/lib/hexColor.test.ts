import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidHex, normalizeHex, toColorInputValue, HEX_COLOR_RE } from './hexColor';

test('isValidHex: מקבל שש ספרות ושלוש ספרות עם #', () => {
  assert.equal(isValidHex('#0A182D'), true);
  assert.equal(isValidHex('#abc'), true);
  assert.equal(isValidHex('  #FFFFFF  '), true); // רווחים מסביב
});

test('isValidHex: דוחה קלט לא תקין', () => {
  assert.equal(isValidHex('0A182D'), false); // חסר #
  assert.equal(isValidHex('#12'), false); // אורך שגוי
  assert.equal(isValidHex('#12345'), false);
  assert.equal(isValidHex('#gggggg'), false); // תווים לא הקסה
  assert.equal(isValidHex(''), false);
});

test('normalizeHex: מוסיף # חסר וממיר לאותיות קטנות', () => {
  assert.equal(normalizeHex('0A182D'), '#0a182d');
  assert.equal(normalizeHex('#0A182D'), '#0a182d');
});

test('normalizeHex: מרחיב צורה מקוצרת', () => {
  assert.equal(normalizeHex('#abc'), '#aabbcc');
  assert.equal(normalizeHex('f0a'), '#ff00aa');
});

test('normalizeHex: מחזיר null על ריק/לא תקין', () => {
  assert.equal(normalizeHex(''), null);
  assert.equal(normalizeHex('   '), null);
  assert.equal(normalizeHex('not-a-color'), null);
  assert.equal(normalizeHex('#1234'), null);
});

test('toColorInputValue: תמיד מחזיר #rrggbb, נופל לברירת מחדל', () => {
  assert.equal(toColorInputValue('#abc', '#0a182d'), '#aabbcc');
  assert.equal(toColorInputValue('', '#0a182d'), '#0a182d');
  assert.equal(toColorInputValue('junk', '#123456'), '#123456');
});

test('HEX_COLOR_RE: חשוף לשימוש חוזר', () => {
  assert.equal(HEX_COLOR_RE.test('#fff'), true);
  assert.equal(HEX_COLOR_RE.test('fff'), false);
});
