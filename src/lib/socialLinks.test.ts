import { test } from 'node:test';
import assert from 'node:assert/strict';
import { socialHref } from './socialLinks';

test('socialHref מחזיר כתובת מלאה כפי שהיא', () => {
  assert.equal(socialHref('instagram', 'https://example.com/x'), 'https://example.com/x');
  assert.equal(socialHref('whatsapp', 'http://wa.me/123'), 'http://wa.me/123');
});

test('socialHref מסיר @ עבור אינסטגרם', () => {
  assert.equal(socialHref('instagram', '@torchick'), 'https://instagram.com/torchick');
  assert.equal(socialHref('instagram', 'torchick'), 'https://instagram.com/torchick');
});

test('socialHref בונה wa.me מספרות בלבד', () => {
  assert.equal(socialHref('whatsapp', '+972 50-123-4567'), 'https://wa.me/972501234567');
  assert.equal(socialHref('whatsapp', '050-123-4567'), 'https://wa.me/972501234567');
  assert.equal(socialHref('whatsapp', '02-123-4567'), 'https://wa.me/97221234567');
  assert.equal(socialHref('whatsapp', '+1 415 555 0123'), 'https://wa.me/14155550123');
  assert.equal(socialHref('whatsapp', '14155550123'), 'https://wa.me/14155550123');
});

test('socialHref בונה טיקטוק עם @', () => {
  assert.equal(socialHref('tiktok', 'torchick'), 'https://tiktok.com/@torchick');
  assert.equal(socialHref('tiktok', '@torchick'), 'https://tiktok.com/@torchick');
});

test('socialHref בונה פייסבוק ללא @', () => {
  assert.equal(socialHref('facebook', '@page'), 'https://facebook.com/page');
});
