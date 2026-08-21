import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapEmbedUrl, googleMapsSearchUrl, wazeUrl } from './mapLinks';

const ADDR = 'הקישון 5, יבנה';
const ENC = encodeURIComponent(ADDR);

test('mapEmbedUrl: בונה קישור embed מהכתובת המקודדת ללא קואורדינטות', () => {
  assert.equal(mapEmbedUrl(ADDR), `https://www.google.com/maps?q=${ENC}&output=embed`);
  // אין קואורדינטות גולמיות (פסיק בין מספרים) בקישור
  assert.ok(!/@?-?\d+\.\d+,-?\d+\.\d+/.test(mapEmbedUrl(ADDR)!));
});

test('googleMapsSearchUrl: בונה קישור חיפוש עם api=1 והכתובת המקודדת', () => {
  assert.equal(googleMapsSearchUrl(ADDR), `https://www.google.com/maps/search/?api=1&query=${ENC}`);
});

test('wazeUrl: בונה קישור Waze עם שאילתת הכתובת המקודדת', () => {
  assert.equal(wazeUrl(ADDR), `https://waze.com/ul?q=${ENC}`);
});

test('בוני הקישורים מקזזים רווחים ומחזירים null כשאין כתובת', () => {
  assert.equal(mapEmbedUrl('  '), null);
  assert.equal(googleMapsSearchUrl(null), null);
  assert.equal(wazeUrl(undefined), null);
  assert.equal(mapEmbedUrl('  ' + ADDR + '  '), `https://www.google.com/maps?q=${ENC}&output=embed`);
});

test('בוני הקישורים מקודדים תווים מיוחדים בבטחה', () => {
  const tricky = 'רח׳ א&ב #7, תל־אביב';
  const enc = encodeURIComponent(tricky);
  assert.equal(mapEmbedUrl(tricky), `https://www.google.com/maps?q=${enc}&output=embed`);
  assert.ok(!mapEmbedUrl(tricky)!.includes('&b'));
});
