import { test } from 'node:test';
import assert from 'node:assert/strict';

import { heroVideoResolve, socialVideoResolve } from './videoEmbed';

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

// ---- socialVideoResolve (הטמעות חברתיות רשמיות בעמוד הציבורי) ----

test('social: ריק / null → null', () => {
  assert.equal(socialVideoResolve(null), null);
  assert.equal(socialVideoResolve(undefined), null);
  assert.equal(socialVideoResolve('   '), null);
});

test('social: youtube → iframe פרטיות (youtube-nocookie, ללא autoplay)', () => {
  const v = socialVideoResolve('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(v?.platform, 'youtube');
  assert.ok(v && v.platform === 'youtube' && v.src.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'));
  assert.ok(v && v.platform === 'youtube' && !v.src.includes('autoplay'));
});

test('social: youtu.be קצר → youtube', () => {
  const v = socialVideoResolve('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(v?.platform, 'youtube');
});

test('social: tiktok מלא → videoId מחולץ', () => {
  const v = socialVideoResolve('https://www.tiktok.com/@some.user/video/7212345678901234567');
  assert.deepEqual(v, {
    platform: 'tiktok',
    cite: 'https://www.tiktok.com/@some.user/video/7212345678901234567',
    videoId: '7212345678901234567',
  });
});

test('social: tiktok מקוצר (vm) → videoId null, cite=url', () => {
  const v = socialVideoResolve('https://vm.tiktok.com/ZMabc123/');
  assert.equal(v?.platform, 'tiktok');
  assert.ok(v && v.platform === 'tiktok' && v.videoId === null);
  assert.ok(v && v.platform === 'tiktok' && v.cite === 'https://vm.tiktok.com/ZMabc123/');
});

test('social: vimeo → iframe נגן', () => {
  const v = socialVideoResolve('https://vimeo.com/123456789');
  assert.deepEqual(v, { platform: 'vimeo', src: 'https://player.vimeo.com/video/123456789' });
});

test('social: זבל / כתובת קובץ ישירה → null', () => {
  assert.equal(socialVideoResolve('just text'), null);
  assert.equal(socialVideoResolve('https://cdn.example.com/promo.mp4'), null);
  assert.equal(socialVideoResolve('/images/hero.mp4'), null);
});
