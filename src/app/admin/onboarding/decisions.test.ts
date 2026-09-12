import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidePremiumStep, parsePremiumDraft, publishPremiumDraft } from './premium';
import { landingDefaults, type LandingContent } from '@/lib/publicPageStyle';
import { publicPagePresentation } from '@/server/publicPagePresentation';

test('skipping highlights persists explicit exclusion rather than fallback benefits', () => {
  const draft: LandingContent = { heroImages: ['/hero.png'], benefits: [{ title: 'Old', text: 'Old' }] };
  const result = parsePremiumDraft(JSON.stringify(publishPremiumDraft(decidePremiumStep(draft, 'why', 'skip'))))!;
  assert.equal(result.sections?.highlights, false);
  assert.equal(result.benefits, undefined);
  assert.deepEqual(result.heroImages, draft.heroImages);
  assert.equal(draft.benefits?.[0].title, 'Old');
});

test('continue accepts shown defaults and can re-enable a skipped section', () => {
  const skipped = decidePremiumStep({}, 'why', 'skip', 'BARBERSHOP');
  const result = decidePremiumStep(skipped, 'why', 'continue', 'BARBERSHOP');
  assert.equal(result.sections?.highlights, true);
  assert.deepEqual(result.benefits, landingDefaults('BARBERSHOP').benefits);
  const edited = [{ title: 'Custom', text: 'Authored' }];
  assert.deepEqual(decidePremiumStep({ benefits: edited }, 'why', 'continue').benefits, edited);
});

test('all optional groups can be skipped without downgrading an explicitly published premium page', () => {
  let draft: LandingContent = {
    galleryImageUrls: ['/gallery.png'], socialLinks: { instagram: 'https://instagram.com/example' },
    googleReviewsUrl: 'https://example.com/reviews', instagramPostUrls: ['https://instagram.com/p/example'],
    socialVideoUrls: ['https://youtube.com/example'], facebookFeedUrl: 'https://facebook.com/example',
    heroImages: ['/hero.png'], heroVideoUrl: '/hero.mp4', heroPosterUrl: '/poster.png',
    hotDeals: { images: ['/deal.png'] }, launchOffer: { text: 'Deal', endsAt: '2030-01-01' },
  };
  for (const step of ['gallery', 'social', 'deals', 'about', 'why'] as const) {
    draft = decidePremiumStep(draft, step, 'skip');
  }
  const result = parsePremiumDraft(JSON.stringify(publishPremiumDraft(draft)))!;
  assert.equal(result.presentation, 'premium');
  assert.equal(result.sections?.hero, false);
  for (const key of ['galleryImageUrls', 'socialLinks', 'googleReviewsUrl', 'instagramPostUrls',
    'socialVideoUrls', 'facebookFeedUrl', 'heroImages', 'heroVideoUrl', 'heroPosterUrl',
    'hotDeals', 'launchOffer', 'benefits']) {
    assert.equal(Object.hasOwn(result, key), false, key);
  }
  assert.equal(publicPagePresentation('LANDING', result, 0).isClinicPremium, true);
  assert.equal(publicPagePresentation('BOOKING', result, 3).isClinicPremium, false);
});

test('unconfirmed fallback benefits stay unpublished while authored benefits are preserved', () => {
  assert.equal(publishPremiumDraft({}).sections?.highlights, false);
  assert.equal(publishPremiumDraft({ benefits: [{ title: 'Authored', text: 'Value' }] }).sections?.highlights, true);
});

test('saved hero media renders without requiring a logo or all core onboarding signals', () => {
  for (const content of [{ heroImages: ['/hero.png'] }, { heroVideoUrl: '/hero.mp4' }]) {
    assert.equal(publicPagePresentation('LANDING', content, 2).isClinicPremium, true);
  }
  assert.equal(publicPagePresentation('LANDING', { sections: { gallery: false } }, 3).isClinicPremium, false);
});
