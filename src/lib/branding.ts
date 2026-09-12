import { resolveBrandColor } from './brandColor';
import { darken, lighten } from './hexColor';
import type { LandingContent, LandingTheme } from './publicPageStyle';

export type LandingBrandingPatch = {
  theme?: LandingTheme | null;
  heroImages?: string[];
  announcement?: string | null;
  googleReviewsUrl?: string | null;
};

export function themeFromBrandColor(color: string): LandingTheme {
  const brand = resolveBrandColor(color);
  return {
    brand,
    brandDark: darken(brand, 0.32),
    gold: lighten(brand, 0.45),
    goldStrong: darken(brand, 0.15),
    goldText: darken(brand, 0.6),
    cream: lighten(brand, 0.95),
    ink: '#1b1715',
    accent: lighten(brand, 0.12),
  };
}

// Merge only edited fields; legacy media and omitted sections keep their exact bytes.
export function patchLandingBranding(existing: unknown, patch: LandingBrandingPatch): LandingContent {
  const content: LandingContent = {
    ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
  };
  if (patch.theme === null) delete content.theme;
  else if (patch.theme !== undefined) content.theme = patch.theme;
  if (patch.heroImages !== undefined) content.heroImages = patch.heroImages;
  for (const key of ['announcement', 'googleReviewsUrl'] as const) {
    if (patch[key] === null) delete content[key];
    else if (patch[key] !== undefined) content[key] = patch[key];
  }
  return content;
}
