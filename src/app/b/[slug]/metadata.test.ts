import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBusinessPageMetadata } from './metadata';
import { absoluteUrl, buildMetadata, OG_CARD_PATH } from '@/lib/seo';
import { publicMediaContent } from '@/server/media/publicContent';

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

test('a business without a logo shares text without a generated or platform image', () => {
  const meta = buildBusinessPageMetadata({ name: 'Bella', slug: 'bella', description: null });
  assert.equal(ogImages(meta), undefined);
  assert.equal(twImages(meta), undefined);
});

test('business sharing uses the saved logo directly without a generated card or forced crop', () => {
  const logoUrl = 'https://media.example.com/business/logo.webp';
  const meta = buildBusinessPageMetadata({ name: 'David', slug: 'david', logoUrl });
  assert.deepEqual(ogImages(meta), [{ url: logoUrl, alt: 'David' }]);
  assert.deepEqual(twImages(meta), [logoUrl]);
  assert.ok(meta.twitter && 'card' in meta.twitter);
  assert.equal(meta.twitter.card, 'summary');
  assert.ok(!JSON.stringify(meta).includes('opengraph-image'));
});

test('local and legacy business logos have absolute, non-inline share URLs', () => {
  const local = buildBusinessPageMetadata({
    name: 'Local', slug: 'local', logoUrl: '/images/business/logo.png',
  });
  assert.deepEqual(twImages(local), [absoluteUrl('/images/business/logo.png')]);
  const legacy = publicMediaContent({
    name: 'Legacy', slug: 'legacy', logoUrl: 'data:image/png;base64,YQ==',
  }, 'legacy');
  const meta = buildBusinessPageMetadata(legacy);
  assert.deepEqual(twImages(meta), [absoluteUrl(legacy.logoUrl)]);
  assert.ok(!JSON.stringify(meta).includes('base64'));
});

test('unsupported logo sources do not leak into share metadata', () => {
  for (const logoUrl of ['', 'data:image/png;base64,YQ==', 'javascript:alert(1)', '//example.com/logo.png']) {
    const meta = buildBusinessPageMetadata({ name: 'Business', slug: 'business', logoUrl });
    assert.equal(ogImages(meta), undefined);
    assert.equal(twImages(meta), undefined);
  }
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

test('buildMetadata עם image כמחרוזת דורס את כרטיס הפלטפורמה', () => {
  const url = 'https://cdn.example.com/logo.png';
  const meta = buildMetadata({ title: 'X', path: '/x', image: url });
  const s = JSON.stringify(meta);
  assert.ok(s.includes(url));
  assert.ok(!s.includes('og-card.jpg'));
  assert.deepEqual(twImages(meta), [url]);
});
