import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeStoredLandingContent, LANDING_SECTION_ORDER } from '@/lib/publicPageStyle';
import { publicMediaContent } from '@/server/media/publicContent';
import LandingSections from './LandingSections';
import { t } from '@/i18n';

(globalThis as unknown as { React: typeof React }).React = React;

test('stored public data reaches the section adapter with real ratings, source and reversible visibility', () => {
  const business = {
    landingContent: {
      sections: Object.fromEntries(LANDING_SECTION_ORDER.map((key) => [key, key === 'testimonials'])),
      googleReviewsUrl: 'https://g.page/r/synthetic/review',
      testimonials: [
        {
          name: 'First author', quote: 'First visible review', rating: 5,
          source: { provider: 'google', input: 'user_supplied_screenshot', importedManually: true },
        },
        { name: 'Hidden author', quote: 'Hidden review', rating: 1, hidden: true },
        { name: 'Third author', quote: 'Second visible review', rating: 3 },
      ],
    },
  };
  const projected = publicMediaContent(business, 'synthetic');
  const content = normalizeStoredLandingContent(projected.landingContent);
  const html = renderToStaticMarkup(React.createElement(LandingSections, {
    content, type: 'OTHER', premium: false, services: [], staff: [], businessName: 'Synthetic',
    slug: 'synthetic', workingHours: [], bookHref: '/b/synthetic/book', iconKey: 'calendar',
  }));
  assert.equal((html.match(/<figure\b/g) ?? []).length, 2);
  assert.equal((html.match(/★/g) ?? []).length, 8);
  assert.equal(html.split(t.publicPage.landing.googleReviewSource).length - 1, 1);
  assert.match(html, /href="https:\/\/g\.page\/r\/synthetic\/review"/);
  assert.doesNotMatch(html, /Hidden review|Hidden author/);
  assert.equal(content?.testimonials?.length, 3);
  assert.equal(content?.testimonials?.[1].hidden, true);
});

test('public page and editor initial state explicitly read trusted stored content', () => {
  const page = readFileSync(new URL('../../app/b/[slug]/page.tsx', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../../app/admin/onboarding/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /normalizeStoredLandingContent\(business\.landingContent\)/);
  assert.match(editor, /normalizeStoredLandingContent\(business\.landingContent\)/);
});
