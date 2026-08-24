import { test } from 'node:test';
import assert from 'node:assert/strict';

import { heroVideoResolve } from './videoEmbed';

test('ריק / null / undefined → null', () => {
  assert.equal(heroVideoResolve(null), null);
  assert.equal(heroVideoResolve(undefined), null);
  assert.equal(heroVideoResolve('   '), null);
});

test('youtu.be קצר → embed עם playlist=id', () => {
  const hv = heroVideoResolve('https://youtu.be/dQw4w9WgXcQ');
  assert.deepEqual(hv, {
    kind: 'embed',
    src: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&controls=0&playsinline=1&modestbranding=1&rel=0&playlist=dQw4w9WgXcQ',
  });
});

test('youtube watch?v= → embed', () => {
  const hv = heroVideoResolve('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s');
  assert.equal(hv?.kind, 'embed');
  assert.ok(hv && hv.src.includes('/embed/dQw4w9WgXcQ?'));
  assert.ok(hv && hv.src.includes('playlist=dQw4w9WgXcQ'));
});

test('youtube shorts → embed', () => {
  const hv = heroVideoResolve('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  assert.equal(hv?.kind, 'embed');
  assert.ok(hv && hv.src.includes('/embed/dQw4w9WgXcQ?'));
});

test('vimeo → embed רקע', () => {
  const hv = heroVideoResolve('https://vimeo.com/123456789');
  assert.deepEqual(hv, {
    kind: 'embed',
    src: 'https://player.vimeo.com/video/123456789?autoplay=1&muted=1&loop=1&background=1',
  });
});

test('player.vimeo.com/video → embed', () => {
  const hv = heroVideoResolve('https://player.vimeo.com/video/987654321');
  assert.equal(hv?.kind, 'embed');
  assert.ok(hv && hv.src.includes('/video/987654321?'));
});

test('כתובת mp4 ישירה → file', () => {
  const hv = heroVideoResolve('https://cdn.example.com/promo.mp4');
  assert.deepEqual(hv, { kind: 'file', src: 'https://cdn.example.com/promo.mp4' });
});

test('נתיב שורש יחסי ל-mp4 → file', () => {
  const hv = heroVideoResolve('/images/hero.mp4');
  assert.deepEqual(hv, { kind: 'file', src: '/images/hero.mp4' });
});

test('זבל שאינו כתובת → null', () => {
  assert.equal(heroVideoResolve('just some text'), null);
  assert.equal(heroVideoResolve('ftp://example.com/x.mp4'), null);
});
