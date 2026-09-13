import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_PRESETS } from '@/app/admin/onboarding/premium';
import { normalizeLandingContent } from '@/lib/publicPageStyle';
import { buildClinicLandingContent } from '@/data/clinicDemo';
import {
  DEFAULT_PUBLIC_LANDING_THEME,
  publicLandingThemeVars,
  publicPagePresentation,
} from './publicPagePresentation';

const blue = BRAND_PRESETS.find((preset) => preset.id === 'clinical-blue')!.theme;

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('actual barber configuration: LANDING, blue theme only and full onboarding retain branded header', () => {
  const result = publicPagePresentation('LANDING', normalizeLandingContent({ theme: blue }), 3);
  assert.equal(result.isLanding, true);
  assert.equal(result.isClinicPremium, false);
  assert.equal(result.landingThemeVars['--c-gold'], '#8fb9df');
  assert.equal(result.landingThemeVars['--biz'], '#3b82c4');
  assert.equal(result.landingThemeVars['--biz-strong'], '#2c63a0');
  assert.equal(result.landingThemeVars['--c-hero-cta'], '#3b82c4');
  assert.equal(result.landingThemeVars['--c-cream'], '#f2f7fc');
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
    assert.equal(result.landingThemeVars['--c-gold'], theme.gold);
    assert.equal(result.landingThemeVars['--c-gold-strong'], theme.goldStrong);
    assert.equal(result.landingThemeVars['--c-gold-text'], theme.goldText);
    assert.equal(result.landingThemeVars['--c-brand'], theme.brand);
    assert.equal(result.landingThemeVars['--biz'], theme.brand);
    assert.equal(result.landingThemeVars['--biz-strong'], theme.brandDark);
    assert.equal(result.landingThemeVars['--c-ink'], theme.ink);
    assert.equal(result.landingThemeVars['--c-accent'], theme.accent);
    assert.equal(result.landingThemeVars['--c-hero-cta-strong'], theme.brandDark);
  }
});

test('existing clinic keeps rich presentation, warm colors and original rose CTA without a custom theme', () => {
  const result = publicPagePresentation('LANDING', buildClinicLandingContent(), 0);
  assert.equal(result.isClinicPremium, true);
  assert.equal(result.landingThemeVars['--c-gold'], '#c6a86a');
  assert.equal(result.landingThemeVars['--biz'], '#b0855f');
  assert.equal(result.landingThemeVars['--biz-strong'], '#8c6748');
  assert.equal(result.landingThemeVars['--c-hero-cta'], '#c08f86');
  assert.equal(result.landingThemeVars['--c-hero-cta-strong'], '#a06c63');
});

test('palette variables cover every public surface role without retaining legacy bronze values', () => {
  const pink = BRAND_PRESETS.find((preset) => preset.id === 'soft-rose')!.theme;
  const variables = publicLandingThemeVars(pink);
  for (const key of [
    '--biz', '--biz-strong', '--biz-dark', '--biz-light', '--biz-ink', '--biz-soft',
    '--biz-softer', '--biz-border', '--c-gold', '--c-gold-strong', '--c-gold-text',
    '--c-gold-soft', '--c-gold-glow', '--c-cream', '--c-surface', '--c-surface-muted',
    '--c-border', '--c-ink', '--c-muted', '--c-brand', '--c-brand-strong', '--c-brand-soft',
    '--c-accent', '--c-accent-strong', '--c-accent-soft', '--c-dark-surface',
    '--c-dark-surface-soft', '--c-dark-glow-primary', '--c-dark-glow-secondary',
    '--c-on-brand', '--c-on-gold', '--c-on-accent', '--c-on-dark', '--c-shadow',
    '--c-hero-overlay-soft', '--c-hero-overlay-medium', '--c-hero-overlay-strong',
    '--c-hero-glow', '--c-hero-cta', '--c-hero-cta-strong', '--c-hero-cta-ink',
  ]) {
    assert.ok(variables[key as keyof typeof variables], `missing ${key}`);
  }
  assert.equal(variables['--biz'], pink.brand);
  assert.equal(variables['--c-accent'], pink.accent);
  assert.notEqual(variables['--c-dark-glow-primary'], 'rgba(198, 168, 106, 0.2)');
  assert.notEqual(variables['--c-hero-overlay-strong'], 'rgba(44, 37, 34, 0.88)');
});

test('default palette preserves the legacy premium fallback contract', () => {
  const variables = publicLandingThemeVars();
  assert.equal(variables['--biz'], DEFAULT_PUBLIC_LANDING_THEME.brand);
  assert.equal(variables['--c-gold'], DEFAULT_PUBLIC_LANDING_THEME.gold);
  assert.equal(variables['--c-cream'], DEFAULT_PUBLIC_LANDING_THEME.cream);
  assert.equal(variables['--c-ink'], DEFAULT_PUBLIC_LANDING_THEME.ink);
  assert.equal(variables['--c-hero-cta'], DEFAULT_PUBLIC_LANDING_THEME.accent);
});

test('every curated palette keeps button and dark-surface text at WCAG AA contrast', () => {
  for (const { id, theme } of BRAND_PRESETS) {
    const variables = publicLandingThemeVars(theme);
    for (const [foreground, background] of [
      ['--c-on-brand', '--c-brand'],
      ['--c-on-gold', '--c-gold'],
      ['--c-on-accent', '--c-accent'],
      ['--c-on-dark', '--c-ink'],
      ['--c-hero-cta-ink', '--c-hero-cta'],
    ] as const) {
      assert.ok(
        contrastRatio(variables[foreground], variables[background]) >= 4.5,
        `${id}: ${foreground} must remain readable on ${background}`,
      );
    }
  }
});
