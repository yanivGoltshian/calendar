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
  BusinessImportEvidenceMethod,
  BusinessImportHours,
  BusinessImportService,
  BusinessImportSocialLink,
  BusinessImportSourceType,
  BusinessImportWarning,
  TorChickBusinessType,
} from './types';
export {
  BusinessImportError,
  createPinnedLookup,
  fetchPublicImage,
  isBlockedHostname,
  isPublicNetworkAddress,
  parsePublicHttpUrl,
} from './network';
export type {
  BusinessImportDiagnostics,
  BusinessImportFetch,
  BusinessImportResolver,
  ImportedPublicImage,
} from './network';

export interface BusinessImportOptions extends BusinessImportNetworkOptions {
  maxPages?: number;
  concurrency?: number;
}

const MAX_PAGES = 6;
const MAX_CONCURRENCY = 3;

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
  if (/(?:^|\.)calmark\./i.test(hostname)) return 'calmark';
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

  if (sourceType === 'instagram' || sourceType === 'facebook') {
    draft.warnings.unshift(platformWarning(sourceType));
    if (looksPlatformBlocked(initial.html)) {
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
