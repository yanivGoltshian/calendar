import { readableText } from '@/lib/brandColor';
import { darken, lighten, mix, withAlpha } from '@/lib/hexColor';
import {
  normalizePublicPageStyle,
  type LandingContent,
  type LandingTheme,
} from '@/lib/publicPageStyle';
import type { VisualLevel } from './onboardingProgress';

export const DEFAULT_PUBLIC_LANDING_THEME: LandingTheme = {
  brand: '#b0855f',
  brandDark: '#8c6748',
  gold: '#c6a86a',
  goldStrong: '#a6863f',
  goldText: '#8c6748',
  cream: '#faf6ef',
  ink: '#1b1715',
  accent: '#c08f86',
};

export function publicLandingThemeVars(theme?: LandingTheme | null) {
  const palette = theme ?? DEFAULT_PUBLIC_LANDING_THEME;
  const heroCta = theme?.brand ?? DEFAULT_PUBLIC_LANDING_THEME.accent;
  const heroCtaStrong = theme?.brandDark ?? '#a06c63';
  return {
    '--biz': palette.brand,
    '--biz-strong': palette.brandDark,
    '--biz-dark': darken(palette.brand, 0.36),
    '--biz-light': palette.accent,
    '--biz-ink': readableText(palette.brand),
    '--biz-ink-strong': palette.goldText,
    '--biz-soft': withAlpha(palette.brand, 0.1),
    '--biz-softer': withAlpha(palette.brand, 0.05),
    '--biz-border': withAlpha(palette.brandDark, 0.22),
    '--c-gold': palette.gold,
    '--c-gold-strong': palette.goldStrong,
    '--c-gold-text': palette.goldText,
    '--c-gold-soft': withAlpha(palette.gold, 0.22),
    '--c-gold-glow': withAlpha(palette.gold, 0.35),
    '--c-cream': palette.cream,
    '--c-surface': lighten(palette.cream, 0.38),
    '--c-surface-muted': mix(palette.cream, palette.brand, 0.05),
    '--c-border': mix(palette.cream, palette.brandDark, 0.18),
    '--c-ink': palette.ink,
    '--c-muted': mix(palette.ink, palette.cream, 0.38),
    '--c-brand': palette.brand,
    '--c-brand-strong': palette.brandDark,
    '--c-brand-soft': withAlpha(palette.brand, 0.15),
    '--c-accent': palette.accent,
    '--c-accent-strong': darken(palette.accent, 0.18),
    '--c-accent-soft': withAlpha(palette.accent, 0.15),
    '--c-dark-surface': darken(palette.ink, 0.06),
    '--c-dark-surface-soft': lighten(palette.ink, 0.08),
    '--c-dark-glow-primary': withAlpha(palette.gold, 0.2),
    '--c-dark-glow-secondary': withAlpha(palette.brand, 0.22),
    '--c-on-brand': readableText(palette.brand),
    '--c-on-gold': readableText(palette.gold),
    '--c-on-accent': readableText(palette.accent),
    '--c-on-dark': readableText(palette.ink),
    '--c-shadow': withAlpha(palette.ink, 0.5),
    '--c-hero-overlay-soft': withAlpha(palette.ink, 0.14),
    '--c-hero-overlay-medium': withAlpha(palette.ink, 0.5),
    '--c-hero-overlay-strong': withAlpha(palette.ink, 0.88),
    '--c-hero-glow': withAlpha(palette.brandDark, 0.38),
    '--c-hero-cta': heroCta,
    '--c-hero-cta-strong': heroCtaStrong,
    '--c-hero-cta-ink': readableText(heroCta),
  };
}

export function publicPagePresentation(
  pageStyle: string | null | undefined,
  content: LandingContent | null,
  visualLevel: VisualLevel,
) {
  // Branding and section preferences alone do not constitute a rich landing page.
  const hasDetails = content != null &&
    Object.keys(content).some((key) => key !== 'theme' && key !== 'sections' && key !== 'presentation');
  const isLanding = normalizePublicPageStyle(pageStyle) === 'LANDING';
  const isClinicPremium = isLanding && (
    content?.presentation === 'premium' ||
    Boolean(content?.heroVideoUrl || content?.heroImages?.length) ||
    Boolean(content?.launchOffer || content?.hotDeals) ||
    (visualLevel === 3 && hasDetails)
  );
  return {
    isLanding,
    isClinicPremium,
    landingThemeVars: publicLandingThemeVars(content?.theme),
  };
}
