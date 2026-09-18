import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingTestimonials from './LandingTestimonials';
import { t } from '@/i18n';

(globalThis as unknown as { React: typeof React }).React = React;

const labels = {
  title: 'Customer reviews',
  googleLabel: 'Reviews on Google',
  googleCta: 'Open Google reviews',
  googleEmptyText: 'No reviews are stored on this site. Open the Google profile.',
};

function render(overrides: Partial<React.ComponentProps<typeof LandingTestimonials>> = {}) {
  return renderToStaticMarkup(
    React.createElement(LandingTestimonials, {
      ...labels,
      items: [],
      ...overrides,
    }),
  );
}

test('reviews section stays absent without factual cards or a valid profile link', () => {
  assert.equal(render(), '');
});

test('URL-only state stays hidden because the Google reviews link is no longer a public CTA', () => {
  const html = render({ googleReviewsUrl: 'https://g.page/r/synthetic/review' });
  assert.equal(html, '');
});

test('stored reviews render as cards with one heading and no Google profile action', () => {
  const html = render({
    items: [
      { name: 'Dana', quote: 'Excellent service' },
      { name: 'Avi', quote: 'Careful and professional' },
      { quote: 'Easy to book' },
    ],
    googleReviewsUrl: 'https://www.google.com/maps/place/Synthetic+Business',
  });
  assert.equal((html.match(/<h2\b/g) ?? []).length, 1);
  assert.equal((html.match(/Customer reviews/g) ?? []).length, 1);
  assert.equal((html.match(/Reviews on Google/g) ?? []).length, 0);
  assert.equal((html.match(/<figure\b/g) ?? []).length, 3);
  assert.equal((html.match(/<svg\b/g) ?? []).length, 0);
  assert.equal((html.match(/<a\b/g) ?? []).length, 0);
  assert.doesNotMatch(html, /★/);
  assert.equal(html.split(t.reviews.missingRating).length - 1, 3);
  assert.ok(!html.includes(t.publicPage.landing.googleReviewSource));
});

test('rated cards show the actual rating and stored source independently of a business link', () => {
  const html = render({
    items: [
      { name: 'First author', quote: 'First review', rating: 4, source: { provider: 'google' } },
      { name: 'Second author', quote: 'Second review', rating: 2 },
    ],
  });
  assert.equal((html.match(/★/g) ?? []).length, 6);
  assert.equal((html.match(/role="img"/g) ?? []).length, 2);
  for (const rating of [4, 2]) {
    assert.ok(html.includes(t.publicPage.landing.testimonialRating.replace('{rating}', String(rating))));
  }
  assert.equal(html.split(t.publicPage.landing.googleReviewSource).length - 1, 1);
  assert.match(html, /<bdi\b[^>]*>First author<\/bdi>/);
  assert.doesNotMatch(html, /box-shadow|rounded-full/);
});

test('legacy missing and invalid ratings show an unrated indicator without invented filled stars', () => {
  for (const rating of [undefined, 0, -1, 6, 4.5, NaN, Infinity]) {
    const html = render({
      items: [{ quote: 'Review without a usable rating', rating }],
      googleReviewsUrl: 'https://g.page/r/synthetic/review',
    });
    assert.doesNotMatch(html, /★/);
    assert.ok(html.includes(t.reviews.missingRating));
    assert.ok(html.includes(t.reviews.sourceUnknown));
  }
});

test('platform rating-only cards have the real source logo and no empty quotation', () => {
  const html = render({
    platformReviews: [{ id: 'synthetic-review', name: 'Synthetic', rating: 5, quote: '', editedByBusiness: false }],
    submitHref: '/b/synthetic/reviews/new',
  });
  assert.equal((html.match(/<figure\b/g) ?? []).length, 1);
  assert.equal((html.match(/★/g) ?? []).length, 5);
  assert.doesNotMatch(html, /<blockquote\b/);
  assert.match(html, /torchick-emblem-mark/);
  assert.match(html, /data-review-source="torchick"/);
  assert.ok(html.includes(t.reviews.sourcePlatform));
  assert.doesNotMatch(html, /data-review-source="google"|items-baseline/);
  assert.match(html, /items-center/);
});

test('Google cards require explicit stored provenance and do not inherit a business Google link', () => {
  const html = render({
    items: [
      { name: 'Google fixture', quote: 'Explicit provenance', rating: 4, source: { provider: 'google', input: 'PRIVATE SOURCE METADATA' } },
      { name: 'Unattributed fixture', quote: 'No provenance', rating: 3 },
    ],
    googleReviewsUrl: 'https://g.page/r/synthetic/review',
  });
  assert.equal((html.match(/data-review-source="google"/g) ?? []).length, 1);
  assert.equal((html.match(/<svg\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /PRIVATE SOURCE METADATA/);
  assert.equal((html.match(/data-review-source="unknown"/g) ?? []).length, 1);
});

test('published business edits disclose and safely render the retained original', () => {
  const html = render({
    platformReviews: [{ id: 'edited', name: 'Synthetic', rating: 3, quote: 'Edited text', editedByBusiness: true, originalQuote: '<script>original</script>' }],
  });
  assert.ok(html.includes(t.reviews.edited));
  assert.ok(html.includes(t.reviews.original));
  assert.match(html, /&lt;script&gt;original&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal((html.match(/★/g) ?? []).length, 3);
});

test('empty review submission state does not claim a Google profile or invent reviews', () => {
  const html = render({ submitHref: '/b/synthetic/reviews/new' });
  assert.match(html, /\/b\/synthetic\/reviews\/new/);
  assert.match(html, /data-review-dialog-trigger/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /<dialog|appointmentId|authorUserId/);
  assert.ok(html.includes(t.reviews.emptyPublic));
  assert.doesNotMatch(html, /<figure\b|No reviews are stored on this site/);
});

test('visibility is explicit and reversible rather than a positional two-review cap', () => {
  const items = [
    { name: 'First', quote: 'First visible', rating: 5 },
    { name: 'Middle', quote: 'Hidden middle', rating: 5, hidden: true },
    { name: 'Last', quote: 'Last visible', rating: 3, hidden: false },
  ];
  const original = structuredClone(items);
  const html = render({ items });
  assert.equal((html.match(/<figure\b/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Hidden middle|lg:grid-cols-3/);
  assert.match(html, /First visible/);
  assert.match(html, /Last visible/);
  assert.deepEqual(items, original);
  const restored = render({ items: items.map((item) => ({ ...item, hidden: false })) });
  assert.equal((restored.match(/<figure\b/g) ?? []).length, 3);
  assert.match(restored, /lg:grid-cols-3/);
  assert.equal(render({ items: [{ quote: 'Hidden only', hidden: true }] }), '');
  const linkOnly = render({
    items: [{ quote: 'Hidden only', hidden: true }],
    googleReviewsUrl: 'https://g.page/r/synthetic/review',
  });
  assert.equal(linkOnly, '');
});
