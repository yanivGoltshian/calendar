import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { t } from '@/i18n';
import { ProfileFields, type ProfileValues } from './fields';

(globalThis as unknown as { React: typeof React }).React = React;

test('settings exposes an ordinary external Google profile link with its existing value', () => {
  const b: ProfileValues = {
    name: 'Synthetic business', type: null, phone: null, address: null,
    description: null, instagramUrl: null, logoUrl: null, coverImageUrl: null,
    brandColor: null, timezone: 'Asia/Jerusalem', publicPageStyle: 'BOOKING',
    landingContent: { googleReviewsUrl: 'https://g.page/r/synthetic/review' },
  };
  const html = renderToStaticMarkup(React.createElement(ProfileFields, { b }));
  assert.ok(html.includes(t.admin.settings.pageStyle.googleReviewsLabel));
  assert.ok(html.includes(t.admin.settings.pageStyle.googleReviewsHint));
  assert.match(html, /name="googleReviewsUrl"/);
  assert.match(html, /value="https:\/\/g\.page\/r\/synthetic\/review"/);
  assert.doesNotMatch(html, /name="(?:reviewsMode|reviewsSource|googleReviews)"/);
  assert.doesNotMatch(html, /מיובאים אוטומטית|חיבור ביקורות|ייבוא ביקורות/);
});

test('onboarding source has no Google review input, connection badge or import help', () => {
  const source = readFileSync(new URL('../onboarding/OnboardingWizard.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /premium-google-reviews|googleHelpOpen|social\.google|i-google/);
  const actions = readFileSync(new URL('../onboarding/actions.ts', import.meta.url), 'utf8');
  assert.match(actions, /parsePremiumDraft\(premiumDraft, business\.landingContent\)/);
});
