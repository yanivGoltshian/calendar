import {
  BusinessImportError,
  fetchPublicHtml,
  parsePublicHttpUrl,
  type BusinessImportFetch,
  type BusinessImportNetworkOptions,
  type ImportedHtmlPage,
} from './network';
import {
  discoverRelevantLinks,
  extractBusinessDraft,
  looksPlatformBlocked,
} from './extract';
import type {
  BusinessImportDraft,
  BusinessImportSourceType,
  BusinessImportWarning,
} from './types';

export type {
  BusinessImportDraft,
  BusinessImportEvidence,
  BusinessImportConfidence,
  BusinessImportEvidenceMethod,
  BusinessImportHours,
  BusinessImportBookingPolicy,
  BusinessImportService,
  BusinessImportSocialLink,
  BusinessImportStaff,
  BusinessImportSourceType,
  BusinessImportWarning,
  TorChickBusinessType,
} from './types';
export {
  BusinessImportError,
  createPinnedLookup,
  fetchPublicImage,
  fetchPublicVideo,
  isBlockedHostname,
  isPublicNetworkAddress,
  parsePublicHttpUrl,
} from './network';
export type {
  BusinessImportDiagnostics,
  BusinessImportFetch,
  BusinessImportResolver,
  ImportedPublicImage,
  ImportedPublicVideo,
} from './network';

export interface BusinessImportOptions extends BusinessImportNetworkOptions {
  maxPages?: number;
  concurrency?: number;
  maxSocialProfiles?: number;
}

const MAX_PAGES = 6;
const MAX_CONCURRENCY = 3;
const MAX_SOCIAL_PROFILES = 1;

function hostnameMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function detectBusinessImportSource(url: string | URL): BusinessImportSourceType {
  const parsed = parsePublicHttpUrl(url);
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (
    hostnameMatches(hostname, 'instagram.com') ||
    hostnameMatches(hostname, 'instagr.am')
  ) {
    return 'instagram';
  }
  if (
    hostnameMatches(hostname, 'facebook.com') ||
    hostnameMatches(hostname, 'fb.com') ||
    hostnameMatches(hostname, 'fb.me')
  ) {
    return 'facebook';
  }
  if (
    hostnameMatches(hostname, 'calmark.io') ||
    hostnameMatches(hostname, 'calmark.co.il')
  ) {
    return 'calmark';
  }
  return 'generic-site';
}

function platformWarning(sourceType: 'instagram' | 'facebook'): BusinessImportWarning {
  return {
    code: 'platform-metadata-only',
    message: `Only public HTML metadata was inspected for ${sourceType}; authenticated or dynamically loaded content is intentionally unavailable.`,
  };
}

function platformBlockedWarning(
  sourceType: 'instagram' | 'facebook',
  sourceUrl: string,
  detail: string,
): BusinessImportWarning {
  return {
    code: 'platform-blocked',
    message: `${sourceType} limited public HTML access: ${detail}`,
    sourceUrl,
  };
}

function pageFetchWarning(url: string, error: unknown): BusinessImportWarning {
  const detail =
    error instanceof BusinessImportError
      ? `${error.code}: ${error.message}`
      : 'unknown error';
  return {
    code: 'page-fetch-failed',
    message: `A relevant internal page could not be imported: ${detail}`,
    sourceUrl: url,
  };
}

function socialProfileFetchWarning(url: string, error: unknown): BusinessImportWarning {
  const detail =
    error instanceof BusinessImportError
      ? `${error.code}: ${error.message}`
      : 'unknown error';
  return {
    code: 'social-profile-fetch-failed',
    message: `A linked public social profile could not be imported: ${detail}`,
    sourceUrl: url,
  };
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const candidate = key(value);
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    return true;
  });
}

function mergeBusinessDraft(
  base: BusinessImportDraft,
  enrichment: BusinessImportDraft,
): BusinessImportDraft {
  for (const key of Object.keys(base.business) as Array<keyof typeof base.business>) {
    if (!base.business[key] && enrichment.business[key]) {
      base.business[key] = enrichment.business[key] as never;
    }
  }
  for (const key of Object.keys(base.location) as Array<keyof typeof base.location>) {
    if (!base.location[key] && enrichment.location[key]) {
      base.location[key] = enrichment.location[key];
    }
  }
  base.contacts.phones = uniqueBy(
    [...base.contacts.phones, ...enrichment.contacts.phones],
    (value) => value.replace(/\D/g, ''),
  );
  base.contacts.emails = uniqueBy(
    [...base.contacts.emails, ...enrichment.contacts.emails],
    (value) => value.toLowerCase(),
  );
  base.hours = uniqueBy(
    [...base.hours, ...enrichment.hours],
    (value) => `${value.dayOfWeek.join(',')}|${value.opens}|${value.closes}|${value.raw}`,
  );
  base.services = uniqueBy([...base.services, ...enrichment.services], (value) =>
    value.name.toLowerCase().trim(),
  );
  base.staff = uniqueBy([...base.staff, ...enrichment.staff], (value) =>
    value.name.toLowerCase().trim(),
  );
  for (const key of [
    'minLeadTimeMinutes',
    'cancellationWindowHours',
    'maxAdvanceBookingDays',
    'bookingRequiresApproval',
  ] as const) {
    if (base.bookingPolicy[key] === null && enrichment.bookingPolicy[key] !== null) {
      base.bookingPolicy[key] = enrichment.bookingPolicy[key] as never;
    }
  }
  base.bookingPolicy.notes = uniqueBy(
    [...base.bookingPolicy.notes, ...enrichment.bookingPolicy.notes],
    (value) => value.toLowerCase(),
  );
  base.media.logoUrl ??= enrichment.media.logoUrl;
  base.media.coverImageUrl ??= enrichment.media.coverImageUrl;
  base.media.galleryImageUrls = uniqueBy(
    [...base.media.galleryImageUrls, ...enrichment.media.galleryImageUrls],
    (value) => value,
  );
  base.media.videoUrls = uniqueBy(
    [...base.media.videoUrls, ...enrichment.media.videoUrls],
    (value) => value,
  );
  base.media.instagramPostUrls = uniqueBy(
    [...base.media.instagramPostUrls, ...enrichment.media.instagramPostUrls],
    (value) => value,
  );
  base.socialLinks = uniqueBy(
    [...base.socialLinks, ...enrichment.socialLinks],
    (value) => `${value.platform}:${value.url}`,
  );
  base.fetchedUrls = uniqueBy(
    [...base.fetchedUrls, ...enrichment.fetchedUrls],
    (value) => value,
  );
  base.evidence = uniqueBy(
    [...base.evidence, ...enrichment.evidence],
    (value) =>
      `${value.field}|${value.value}|${value.sourceUrl}|${value.method}|${value.detail ?? ''}`,
  );
  const resolvedMissingCodes = new Set<BusinessImportWarning['code']>();
  if (base.business.name) resolvedMissingCodes.add('missing-name');
  if (base.contacts.phones.length || base.contacts.emails.length) {
    resolvedMissingCodes.add('missing-contact');
  }
  if (base.location.formattedAddress) resolvedMissingCodes.add('missing-address');
  if (base.hours.length) resolvedMissingCodes.add('missing-hours');
  if (base.services.length) resolvedMissingCodes.add('missing-services');
  if (base.staff.length) resolvedMissingCodes.add('missing-staff');
  if (
    base.bookingPolicy.notes.length ||
    base.bookingPolicy.minLeadTimeMinutes !== null ||
    base.bookingPolicy.cancellationWindowHours !== null ||
    base.bookingPolicy.maxAdvanceBookingDays !== null ||
    base.bookingPolicy.bookingRequiresApproval !== null
  ) {
    resolvedMissingCodes.add('missing-policy');
  }
  if (
    base.media.logoUrl ||
    base.media.coverImageUrl ||
    base.media.galleryImageUrls.length ||
    base.media.videoUrls.length
  ) {
    resolvedMissingCodes.add('missing-media');
  }
  base.warnings = uniqueBy(
    [...base.warnings, ...enrichment.warnings].filter(
      (warning) => !resolvedMissingCodes.has(warning.code),
    ),
    (warning) => `${warning.code}|${warning.sourceUrl ?? ''}|${warning.message}`,
  );
  return base;
}

async function enrichLinkedSocialProfiles(
  draft: BusinessImportDraft,
  fetchImpl: BusinessImportFetch,
  options: BusinessImportOptions,
): Promise<BusinessImportDraft> {
  const maxProfiles = Math.max(
    0,
    Math.min(
      MAX_SOCIAL_PROFILES,
      Math.floor(options.maxSocialProfiles ?? MAX_SOCIAL_PROFILES),
    ),
  );
  if (maxProfiles === 0) return draft;
  if (
    draft.business.name &&
    draft.business.description &&
    draft.location.formattedAddress &&
    draft.contacts.phones.length > 0
  ) {
    return draft;
  }
  const profileUrls = draft.socialLinks
    .filter(({ platform }) => platform === 'instagram')
    .slice(0, maxProfiles)
    .map(({ url }) => url);
  for (const profileUrl of profileUrls) {
    try {
      const page = await fetchPublicHtml(profileUrl, fetchImpl, options);
      mergeBusinessDraft(
        draft,
        extractBusinessDraft(
          [page],
          detectBusinessImportSource(page.finalUrl),
          profileUrl,
        ),
      );
    } catch (error) {
      draft.warnings.unshift(socialProfileFetchWarning(profileUrl, error));
    }
  }
  return draft;
}

async function fetchDiscoveredPages(
  initial: ImportedHtmlPage,
  fetchImpl: BusinessImportFetch,
  options: BusinessImportOptions,
): Promise<{ pages: ImportedHtmlPage[]; warnings: BusinessImportWarning[] }> {
  const maxPages = Math.max(
    1,
    Math.min(MAX_PAGES, Math.floor(options.maxPages ?? MAX_PAGES)),
  );
  const concurrency = Math.max(
    1,
    Math.min(MAX_CONCURRENCY, Math.floor(options.concurrency ?? 2)),
  );
  const pages = [initial];
  const warnings: BusinessImportWarning[] = [];
  const attempted = new Set<string>([initial.finalUrl]);
  const queued = new Set<string>();
  const queue: string[] = [];
  const origin = new URL(initial.finalUrl).origin;

  const enqueue = (html: string, pageUrl: string) => {
    for (const url of discoverRelevantLinks(html, pageUrl)) {
      if (attempted.has(url) || queued.has(url)) continue;
      queued.add(url);
      queue.push(url);
    }
  };
  enqueue(initial.html, initial.finalUrl);

  while (queue.length > 0 && attempted.size < maxPages) {
    const available = maxPages - attempted.size;
    const batch = queue.splice(0, Math.min(concurrency, available));
    for (const url of batch) {
      queued.delete(url);
      attempted.add(url);
    }
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          return {
            page: await fetchPublicHtml(url, fetchImpl, options, origin),
            warning: null,
          };
        } catch (error) {
          return { page: null, warning: pageFetchWarning(url, error) };
        }
      }),
    );
    for (const result of results) {
      if (result.page) {
        pages.push(result.page);
        enqueue(result.page.html, result.page.finalUrl);
      } else if (result.warning) {
        warnings.push(result.warning);
      }
    }
  }
  return { pages, warnings };
}

/**
 * Imports a public business URL into a normalized, evidence-backed draft.
 * The function is side-effect free beyond bounded HTTP requests and never writes to Prisma.
 */
export async function importBusinessFromUrl(
  inputUrl: string,
  fetchImpl: BusinessImportFetch = globalThis.fetch,
  options: BusinessImportOptions = {},
): Promise<BusinessImportDraft> {
  const sourceUrl = parsePublicHttpUrl(inputUrl).href;
  const sourceType = detectBusinessImportSource(sourceUrl);
  let initial: ImportedHtmlPage;

  try {
    initial = await fetchPublicHtml(sourceUrl, fetchImpl, options);
  } catch (error) {
    if (
      (sourceType === 'instagram' || sourceType === 'facebook') &&
      error instanceof BusinessImportError &&
      error.code === 'http_status' &&
      [401, 403, 429, 451].includes(error.status ?? 0)
    ) {
      const draft = extractBusinessDraft([], sourceType, sourceUrl);
      draft.warnings.unshift(
        platformWarning(sourceType),
        platformBlockedWarning(sourceType, sourceUrl, error.message),
      );
      return draft;
    }
    throw error;
  }

  const crawl =
    sourceType === 'generic-site' || sourceType === 'calmark'
      ? await fetchDiscoveredPages(initial, fetchImpl, options)
      : { pages: [initial], warnings: [] };
  const draft = extractBusinessDraft(crawl.pages, sourceType, sourceUrl);
  draft.warnings.unshift(...crawl.warnings);
  if (sourceType === 'generic-site' || sourceType === 'calmark') {
    await enrichLinkedSocialProfiles(draft, fetchImpl, options);
  }

  if (sourceType === 'instagram' || sourceType === 'facebook') {
    draft.warnings.unshift(platformWarning(sourceType));
    if (
      looksPlatformBlocked(initial.html) &&
      !draft.business.name &&
      !draft.business.description &&
      draft.contacts.phones.length === 0 &&
      !draft.media.logoUrl
    ) {
      draft.warnings.unshift(
        platformBlockedWarning(
          sourceType,
          initial.finalUrl,
          'the returned page appears to be a login or challenge page',
        ),
      );
    }
  }

  return draft;
}
