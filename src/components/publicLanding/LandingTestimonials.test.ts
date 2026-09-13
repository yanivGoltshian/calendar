import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingTestimonials from './LandingTestimonials';

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

test('URL-only state renders one honest title, one message and one action without cards', () => {
  const html = render({ googleReviewsUrl: 'https://g.page/r/synthetic/review' });
  assert.equal((html.match(/<h2\b/g) ?? []).length, 1);
  assert.equal((html.match(/Reviews on Google/g) ?? []).length, 1);
  assert.equal((html.match(/No reviews are stored on this site/g) ?? []).length, 1);
  assert.equal((html.match(/<figure\b/g) ?? []).length, 0);
  assert.equal((html.match(/<a\b/g) ?? []).length, 1);
});

test('stored reviews render as cards with one heading and at most one Google action', () => {
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
  assert.equal((html.match(/<svg\b/g) ?? []).length, 1);
  assert.equal((html.match(/<a\b/g) ?? []).length, 1);
});
