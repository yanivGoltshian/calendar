import { readableText } from '@/lib/brandColor';
import { normalizePublicPageStyle, type LandingContent } from '@/lib/publicPageStyle';
import type { VisualLevel } from './onboardingProgress';

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
  const theme = content?.theme;
  const clinicThemeVars = {
    '--c-gold': theme?.gold ?? '#c6a86a',
    '--c-gold-strong': theme?.goldStrong ?? '#a6863f',
    '--c-gold-text': theme?.goldText ?? '#8c6748',
    '--c-cream': theme?.cream ?? '#faf6ef',
    '--c-ink': theme?.ink ?? '#1b1715',
    '--c-brand': theme?.brand ?? '#b0855f',
    '--biz-strong': theme?.brandDark ?? '#8c6748',
    '--c-hero-cta': theme?.brand ?? '#c08f86',
    '--c-hero-cta-strong': theme?.brandDark ?? '#a06c63',
    '--c-hero-cta-ink': theme ? readableText(theme.brand) : '#ffffff',
  };
  return { isLanding, isClinicPremium, clinicThemeVars };
}
