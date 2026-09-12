// Adapted from PR135 (7abcd5c): one gate for directory, sitemap and metadata.
export const DIRECTORY_MIN_LISTED = 3;
export const DEMO_SLUGS = new Set(['demo-barbershop', 'esek', 'esek-2']);

export type PublicListable = {
  slug?: string;
  listed?: boolean | null;
  accountStatus?: string | null;
  plan?: string;
  trialEndsAt?: Date | null;
  paidUntil?: Date | null;
  settings?: { onboardingCompleted?: boolean } | null;
};

export function isPubliclyListed(business: PublicListable, now = new Date()): boolean {
  const until = business.plan === 'basic' ? business.trialEndsAt : business.paidUntil;
  return business.listed === true && business.accountStatus === 'ACTIVE' &&
    business.settings?.onboardingCompleted === true && !DEMO_SLUGS.has(business.slug ?? '') &&
    !!until && until.getTime() > now.getTime();
}

export function shouldShowDirectoryLink(count: number): boolean {
  return Number.isFinite(count) && count >= DIRECTORY_MIN_LISTED;
}

export function filterPubliclyListed<T extends PublicListable>(businesses: readonly T[], now = new Date()): T[] {
  return businesses.filter((business) => isPubliclyListed(business, now));
}
