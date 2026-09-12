import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patchLandingBranding, themeFromBrandColor } from './branding';
import { normalizeLandingTheme, resolveLandingSections } from './publicPageStyle';
import { BRAND_PRESETS } from '../app/admin/onboarding/premium';

test('primary color changes generate all theme roles instead of retaining an older palette', () => {
  const theme = themeFromBrandColor('#12b886');
  assert.equal(theme.brand, '#12b886');
  assert.deepEqual(normalizeLandingTheme(theme), theme);
  assert.notEqual(theme.brandDark, BRAND_PRESETS[0].theme.brandDark);
  assert.notEqual(theme.gold, BRAND_PRESETS[0].theme.gold);
});

test('updates and review links can be independently saved and cleared without restoring omitted content', () => {
  const existing = { presentation: 'premium', sections: { highlights: false }, heroVideoUrl: '/video.mp4' };
  const patch = { announcement: 'Holiday hours', googleReviewsUrl: 'https://maps.app.goo.gl/example' };
  assert.deepEqual(patchLandingBranding(existing, patch), { ...existing, ...patch });
  assert.deepEqual(patchLandingBranding({ ...existing, ...patch }, { announcement: null }),
    { ...existing, googleReviewsUrl: patch.googleReviewsUrl });
  assert.deepEqual(patchLandingBranding({ ...existing, ...patch }, { announcement: null, googleReviewsUrl: null }),
    existing);
  assert.equal(resolveLandingSections({ content: { googleReviewsUrl: patch.googleReviewsUrl } }).includes('testimonials'), true);
  assert.equal(resolveLandingSections({ content: { googleReviewsUrl: patch.googleReviewsUrl, sections: { testimonials: false } } })
    .includes('testimonials'), false);
  assert.equal(resolveLandingSections({ content: {} }).includes('testimonials'), false);
});

test('branding patches preserve publication, omitted sections and full legacy media', () => {
  const existing = {
    presentation: 'premium', heroImages: ['data:image/png;base64,' + 'a'.repeat(10_000)],
    sections: { highlights: false, socialCta: false }, heroHeadline: 'Existing content',
    theme: BRAND_PRESETS[0].theme,
  };
  const theme = BRAND_PRESETS[1].theme;
  assert.deepEqual(patchLandingBranding(existing, { theme }), { ...existing, theme });
  assert.deepEqual(patchLandingBranding(existing, {}), existing);
  const { theme: omitted, ...withoutTheme } = existing;
  assert.ok(omitted);
  assert.deepEqual(patchLandingBranding(existing, { theme: null }), withoutTheme);
  assert.deepEqual(patchLandingBranding(existing, { heroImages: ['/icons/icon-192.png'] }),
    { ...existing, heroImages: ['/icons/icon-192.png'] });
  assert.deepEqual(patchLandingBranding(null, { theme }), { theme });
});
