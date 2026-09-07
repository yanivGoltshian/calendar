import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isLandingDraftSizeAllowed, isSafeBusinessMediaWrite, isSafeMediaUrl, MAX_LANDING_CONTENT_BYTES,
} from './mediaValidation';

test('new media accepts bounded HTTPS/relative URLs, never data/blob/script or protocol-relative URLs', () => {
  for (const value of ['https://assets.example.test/image.webp', '/uploads/image.webp']) {
    assert.equal(isSafeMediaUrl(value), true);
  }
  for (const value of [
    'data:image/png;base64,abc', 'DATA:image/png;base64,abc', 'blob:https://example.test/id',
    'javascript:alert(1)', '//example.test/image.png', '/\\example.test/image.png',
    `https://example.test/${'x'.repeat(2048)}`,
  ]) assert.equal(isSafeMediaUrl(value), false, value.slice(0, 60));
});

test('legacy data URLs stay valid only at their unchanged original positions', () => {
  const legacy = `data:image/png;base64,${'a'.repeat(70000)}`;
  const previous = { logoUrl: legacy, landingContent: { heroImages: [legacy], about: 'Before' } };
  assert.equal(isSafeBusinessMediaWrite({
    ...previous, landingContent: { heroImages: [legacy], about: 'After' },
  }, previous), true);
  assert.equal(isSafeBusinessMediaWrite({ coverImageUrl: legacy }, previous), false);
  assert.equal(isSafeBusinessMediaWrite({
    landingContent: { heroImages: [legacy, legacy] },
  }, previous), false);
  assert.equal(isSafeBusinessMediaWrite({ logoUrl: legacy + 'b' }, previous), false);
});

test('landing JSON has per-string, aggregate and preparse bounds', () => {
  assert.equal(isSafeBusinessMediaWrite({ landingContent: { about: 'a'.repeat(4097) } }, {}), false);
  const value = { gallery: Array.from({ length: 12 }, () => 'x'.repeat(3000)) };
  assert.equal(isSafeBusinessMediaWrite({ landingContent: value }, {}), false);
  assert.equal(isLandingDraftSizeAllowed('x'.repeat(MAX_LANDING_CONTENT_BYTES + 10), null), false);
  assert.equal(isLandingDraftSizeAllowed('{"about":"short"}', null), true);
});
