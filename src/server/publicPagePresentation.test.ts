import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_PRESETS } from '@/app/admin/onboarding/premium';
import { normalizeLandingContent } from '@/lib/publicPageStyle';
import { buildClinicLandingContent } from '@/data/clinicDemo';
import { publicPagePresentation } from './publicPagePresentation';

const blue = BRAND_PRESETS.find((preset) => preset.id === 'clinical-blue')!.theme;

test('actual barber configuration: LANDING, blue theme only and full onboarding retain branded header', () => {
  const result = publicPagePresentation('LANDING', normalizeLandingContent({ theme: blue }), 3);
  assert.equal(result.isLanding, true);
  assert.equal(result.isClinicPremium, false);
  assert.equal(result.clinicThemeVars['--c-gold'], '#8fb9df');
  assert.equal(result.clinicThemeVars['--biz-strong'], '#2c63a0');
  assert.equal(result.clinicThemeVars['--c-hero-cta'], '#3b82c4');
  assert.equal(result.clinicThemeVars['--c-cream'], '#f2f7fc');
});

test('section preferences without actual content never promote a business to the clinic header', () => {
  const content = normalizeLandingContent({ theme: blue, sections: { gallery: false } });
  assert.equal(publicPagePresentation('LANDING', content, 3).isClinicPremium, false);
});

test('explicit BOOKING wins over completed onboarding and saved rich content', () => {
  const result = publicPagePresentation('BOOKING', buildClinicLandingContent(), 3);
  assert.equal(result.isLanding, false);
  assert.equal(result.isClinicPremium, false);
});

test('partially filled landing remains available without enabling clinic styling', () => {
  const result = publicPagePresentation('LANDING', { heroHeadline: 'New business' }, 2);
  assert.equal(result.isLanding, true);
  assert.equal(result.isClinicPremium, false);
  assert.equal(publicPagePresentation(null, null, 0).isClinicPremium, false);
});

test('complete real rich content still enables rich header with the saved palette', () => {
  for (const { theme } of BRAND_PRESETS) {
    const result = publicPagePresentation('LANDING', { theme, heroHeadline: 'Rich business' }, 3);
    assert.equal(result.isClinicPremium, true);
    assert.equal(result.clinicThemeVars['--c-gold'], theme.gold);
    assert.equal(result.clinicThemeVars['--c-gold-strong'], theme.goldStrong);
    assert.equal(result.clinicThemeVars['--c-gold-text'], theme.goldText);
    assert.equal(result.clinicThemeVars['--c-brand'], theme.brand);
    assert.equal(result.clinicThemeVars['--c-ink'], theme.ink);
    assert.equal(result.clinicThemeVars['--c-hero-cta-strong'], theme.brandDark);
  }
});

test('existing clinic keeps rich presentation, warm colors and original rose CTA without a custom theme', () => {
  const result = publicPagePresentation('LANDING', buildClinicLandingContent(), 0);
  assert.equal(result.isClinicPremium, true);
  assert.equal(result.clinicThemeVars['--c-gold'], '#c6a86a');
  assert.equal(result.clinicThemeVars['--biz-strong'], '#8c6748');
  assert.equal(result.clinicThemeVars['--c-hero-cta'], '#c08f86');
  assert.equal(result.clinicThemeVars['--c-hero-cta-strong'], '#a06c63');
});
