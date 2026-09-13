import { contrastRatio, readableText, readableTextAcross } from '@/lib/brandColor';
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

function contrastSafeBackground(background: string, foreground: string) {
  if (contrastRatio(foreground, background) >= 4.5) return background;
  const target = contrastRatio(foreground, '#ffffff') >= contrastRatio(foreground, '#000000')
    ? '#ffffff'
    : '#000000';
  let low = 0;
  let high = 1;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const middle = (low + high) / 2;
    if (contrastRatio(foreground, mix(background, target, middle)) >= 4.5) high = middle;
    else low = middle;
  }
  return mix(background, target, high);
}

function accessibleGradient(start: string, end: string) {
  const foreground = readableText(start);
  return {
    start: contrastSafeBackground(start, foreground),
    end: contrastSafeBackground(end, foreground),
    foreground,
  };
}

export function publicLandingThemeVars(theme?: LandingTheme | null) {
  const palette = theme ?? DEFAULT_PUBLIC_LANDING_THEME;
  const heroCta = theme?.brand ?? DEFAULT_PUBLIC_LANDING_THEME.accent;
  const heroCtaStrong = theme?.brandDark ?? '#a06c63';
  const surface = lighten(palette.cream, 0.38);
  const surfaceMuted = mix(palette.cream, palette.brand, 0.05);
  const muted = mix(palette.ink, palette.cream, 0.38);
  const accentStrong = darken(palette.accent, 0.18);
  const darkSurface = darken(palette.ink, 0.06);
  const darkSurfaceSoft = lighten(palette.ink, 0.08);
  const lightSurfaces = [surface, surfaceMuted, '#ffffff'];
  const brandAction = accessibleGradient(palette.brand, palette.brandDark);
  const goldAction = accessibleGradient(palette.gold, palette.goldStrong);
  const heroAction = accessibleGradient(heroCta, heroCtaStrong);
  const surfaceAccent = readableTextAcross(lightSurfaces, [palette.brandDark, palette.goldText]);
  return {
    '--biz': palette.brand,
    '--biz-strong': palette.brandDark,
    '--biz-dark': darken(palette.brand, 0.36),
    '--biz-light': palette.accent,
    '--biz-ink': readableText(palette.brand),
    '--biz-ink-strong': surfaceAccent,
    '--biz-text': surfaceAccent,
    '--biz-soft': withAlpha(palette.brand, 0.1),
    '--biz-softer': withAlpha(palette.brand, 0.05),
    '--biz-border': withAlpha(palette.brandDark, 0.22),
    '--c-gold': palette.gold,
    '--c-gold-strong': palette.goldStrong,
    '--c-gold-text': palette.goldText,
    '--c-gold-soft': withAlpha(palette.gold, 0.22),
    '--c-gold-glow': withAlpha(palette.gold, 0.35),
    '--c-cream': palette.cream,
    '--c-surface': surface,
    '--c-surface-muted': surfaceMuted,
    '--c-border': mix(palette.cream, palette.brandDark, 0.18),
    '--c-ink': palette.ink,
    '--c-muted': readableTextAcross([surface, surfaceMuted], [muted]),
    '--c-brand': palette.brand,
    '--c-brand-strong': palette.brandDark,
    '--c-brand-soft': withAlpha(palette.brand, 0.15),
    '--c-brand-action': brandAction.start,
    '--c-brand-action-strong': brandAction.end,
    '--c-on-brand-action': brandAction.foreground,
    '--c-accent': palette.accent,
    '--c-accent-strong': accentStrong,
    '--c-accent-soft': withAlpha(palette.accent, 0.15),
    '--c-accent-text': readableTextAcross([surface, surfaceMuted], [accentStrong]),
    '--c-gold-action': goldAction.start,
    '--c-gold-action-strong': goldAction.end,
    '--c-on-gold-action': goldAction.foreground,
    '--c-dark-surface': darkSurface,
    '--c-dark-surface-soft': darkSurfaceSoft,
    '--c-dark-glow-primary': withAlpha(palette.gold, 0.2),
    '--c-dark-glow-secondary': withAlpha(palette.brand, 0.22),
    '--c-on-brand': readableText(palette.brand),
    '--c-on-gold': readableText(palette.gold),
    '--c-on-accent': readableText(palette.accent),
    '--c-on-dark': readableTextAcross([darkSurface, darkSurfaceSoft]),
    '--c-shadow': withAlpha(palette.ink, 0.5),
    '--c-hero-overlay-soft': withAlpha(palette.ink, 0.14),
    '--c-hero-overlay-medium': withAlpha(palette.ink, 0.5),
    '--c-hero-overlay-strong': withAlpha(palette.ink, 0.88),
    '--c-hero-glow': withAlpha(palette.brandDark, 0.38),
    '--c-hero-cta': heroAction.start,
    '--c-hero-cta-strong': heroAction.end,
    '--c-hero-cta-ink': heroAction.foreground,
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
