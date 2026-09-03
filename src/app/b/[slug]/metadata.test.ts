import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBusinessPageMetadata } from './metadata';
import { buildMetadata, OG_CARD_PATH } from '@/lib/seo';

/** קורא את מערך תמונות ה-openGraph בצורה בטוחת-טיפוס לצורך הבדיקה. */
function ogImages(meta: { openGraph?: unknown }): unknown {
  return (meta.openGraph as { images?: unknown } | undefined)?.images;
}
function twImages(meta: { twitter?: unknown }): unknown {
  return (meta.twitter as { images?: unknown } | undefined)?.images;
}

test('מטא-דאטה של עמוד עסק אינה מפנה לכרטיס הפלטפורמה (og-card.jpg)', () => {
  const meta = buildBusinessPageMetadata({
    name: 'מספרת יוסי',
    slug: 'esek-7',
    description: 'תספורות גברים',
  });
  assert.equal((meta as { title?: unknown }).title, 'מספרת יוסי');
  assert.ok(!JSON.stringify(meta).includes('og-card.jpg'));
});

test('עמוד עסק משמיט openGraph/twitter images כדי לאפשר ל-opengraph-image לספק אותן', () => {
  const meta = buildBusinessPageMetadata({ name: 'Bella', slug: 'bella', description: null });
  assert.equal(ogImages(meta), undefined);
  assert.equal(twImages(meta), undefined);
});

test('עסק חסר (null) — כותרת ניטרלית בלבד, ללא תמונה', () => {
  const meta = buildBusinessPageMetadata(null);
  assert.deepEqual(meta, { title: 'עסק' });
  assert.ok(!JSON.stringify(meta).includes('og-card.jpg'));
});

test('buildMetadata ברירת מחדל (ללא image) שומר על כרטיס הפלטפורמה — התנהגות עמוד הבית ללא שינוי', () => {
  const meta = buildMetadata({ title: 'תור צ׳יק', path: '/' });
  const s = JSON.stringify(meta);
  assert.ok(s.includes('og-card.jpg'));
  assert.ok(s.includes(OG_CARD_PATH));
  assert.ok(JSON.stringify(ogImages(meta)).includes('image/jpeg'));
  assert.ok(JSON.stringify(twImages(meta)).includes('og-card.jpg'));
});

test('buildMetadata עם image:null משמיט תמונות לגמרי', () => {
  const meta = buildMetadata({ title: 'X', path: '/x', image: null });
  assert.equal(ogImages(meta), undefined);
  assert.equal(twImages(meta), undefined);
  assert.ok(!JSON.stringify(meta).includes('og-card.jpg'));
});

test('עסק עם listed=false מקבל robots noindex,nofollow', () => {
  const meta = buildBusinessPageMetadata({
    name: 'עסק מוסתר',
    slug: 'esek',
    description: null,
    listed: false,
  });
  assert.deepEqual((meta as { robots?: unknown }).robots, { index: false, follow: false });
});

test('עסק עם listed=true מאונדקס רגיל (robots index,follow)', () => {
  const meta = buildBusinessPageMetadata({
    name: 'עסק גלוי',
    slug: 'skin-beauty',
    description: null,
    listed: true,
  });
  assert.deepEqual((meta as { robots?: unknown }).robots, { index: true, follow: true });
});

test('עסק ללא דגל listed (undefined) מאונדקס רגיל — תאימות לאחור', () => {
  const meta = buildBusinessPageMetadata({ name: 'עסק', slug: 'x', description: null });
  assert.deepEqual((meta as { robots?: unknown }).robots, { index: true, follow: true });
});

test('buildMetadata עם image כמחרוזת דורס את כרטיס הפלטפורמה', () => {
  const url = 'https://cdn.example.com/logo.png';
  const meta = buildMetadata({ title: 'X', path: '/x', image: url });
  const s = JSON.stringify(meta);
  assert.ok(s.includes(url));
  assert.ok(!s.includes('og-card.jpg'));
  assert.deepEqual(twImages(meta), [url]);
});
