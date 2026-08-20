import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidHex,
  normalizeHex,
  toColorInputValue,
  HEX_COLOR_RE,
  toRgb,
  rgbToHex,
  mix,
  lighten,
  darken,
  withAlpha,
} from './hexColor';

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

test('toRgb: מפרק hex תקין ומקוצר, קלט לא תקין ⇐ שחור', () => {
  assert.deepEqual(toRgb('#ffffff'), [255, 255, 255]);
  assert.deepEqual(toRgb('#000000'), [0, 0, 0]);
  assert.deepEqual(toRgb('#cea24a'), [206, 162, 74]);
  assert.deepEqual(toRgb('#fff'), [255, 255, 255]);
  assert.deepEqual(toRgb('not-a-color'), [0, 0, 0]);
});

test('rgbToHex: מרכיב hex וקוטם לתחום 0–255', () => {
  assert.equal(rgbToHex(206, 162, 74), '#cea24a');
  assert.equal(rgbToHex(0, 0, 0), '#000000');
  assert.equal(rgbToHex(300, -20, 128), '#ff0080');
});

test('mix: 0 ⇐ צבע ראשון, 1 ⇐ צבע שני, 0.5 ⇐ אמצע', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});

test('lighten/darken: מתקרבים ללבן/שחור', () => {
  assert.equal(lighten('#000000', 1), '#ffffff');
  assert.equal(lighten('#000000', 0), '#000000');
  assert.equal(darken('#ffffff', 1), '#000000');
  assert.equal(darken('#ffffff', 0), '#ffffff');
  assert.equal(lighten('#808080', 0.5), '#c0c0c0');
});

test('withAlpha: מחזיר rgba עם שקיפות מוגבלת 0–1', () => {
  assert.equal(withAlpha('#cea24a', 0.5), 'rgba(206, 162, 74, 0.5)');
  assert.equal(withAlpha('#ffffff', 2), 'rgba(255, 255, 255, 1)');
  assert.equal(withAlpha('#000000', -1), 'rgba(0, 0, 0, 0)');
});
