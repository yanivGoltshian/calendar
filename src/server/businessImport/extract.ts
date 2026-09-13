import { load, type CheerioAPI } from 'cheerio';

import {
  isDirectVideoUrl,
  isSupportedSocialVideoUrl,
  normalizeInstagramPostUrl,
} from '@/lib/publicMediaUrl';
import type { ImportedHtmlPage } from './network';
import type {
  BusinessImportDraft,
  BusinessImportEvidence,
  BusinessImportEvidenceMethod,
  BusinessImportHours,
  BusinessImportStaff,
  BusinessImportService,
  BusinessImportSocialLink,
  BusinessImportSourceType,
  TorChickBusinessType,
} from './types';

type JsonRecord = Record<string, unknown>;

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const DAY_ALIASES: Record<string, (typeof DAY_NAMES)[number]> = {
  su: 'sunday',
  sun: 'sunday',
  sunday: 'sunday',
  sundayhe: 'sunday',
  ראשון: 'sunday',
  א: 'sunday',
  mo: 'monday',
  mon: 'monday',
  monday: 'monday',
  שני: 'monday',
  ב: 'monday',
  tu: 'tuesday',
  tue: 'tuesday',
  tues: 'tuesday',
  tuesday: 'tuesday',
  שלישי: 'tuesday',
  ג: 'tuesday',
  we: 'wednesday',
  wed: 'wednesday',
  wednesday: 'wednesday',
  רביעי: 'wednesday',
  ד: 'wednesday',
  th: 'thursday',
  thu: 'thursday',
  thur: 'thursday',
  thursday: 'thursday',
  חמישי: 'thursday',
  ה: 'thursday',
  fr: 'friday',
  fri: 'friday',
  friday: 'friday',
  שישי: 'friday',
  ו: 'friday',
  sa: 'saturday',
  sat: 'saturday',
  saturday: 'saturday',
  שבת: 'saturday',
};

const RELEVANT_LINK_TERMS = [
  'service',
  'services',
  'treatment',
  'treatments',
  'menu',
  'price',
  'pricing',
  'about',
  'contact',
  'gallery',
  'שירות',
  'טיפול',
  'מחיר',
  'אודות',
  'עלינו',
  'צור קשר',
  'יצירת קשר',
  'גלריה',
];

const SOCIAL_HOSTS: Array<{
  platform: BusinessImportSocialLink['platform'];
  hosts: string[];
}> = [
  { platform: 'instagram', hosts: ['instagram.com'] },
  { platform: 'facebook', hosts: ['facebook.com', 'fb.com'] },
  { platform: 'whatsapp', hosts: ['wa.me', 'whatsapp.com'] },
  { platform: 'tiktok', hosts: ['tiktok.com'] },
  { platform: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { platform: 'linkedin', hosts: ['linkedin.com'] },
  { platform: 'x', hosts: ['x.com', 'twitter.com'] },
];

const GENERIC_SERVICE_HEADINGS = new Set([
  'services',
  'our services',
  'treatments',
  'our treatments',
  'products',
  'menu',
  'pricing',
  'שירותים',
  'השירותים שלנו',
  'טיפולים',
  'הטיפולים שלנו',
  'מחירים',
  'אודות',
  'קצת עלינו',
  'נעים להכיר',
  'נעים להכיר, barber & beauty salon.',
  'צור קשר',
  'יצירת קשר',
  'גלריה',
  'גלריית תמונות',
]);

const RESERVED_INSTAGRAM_PATHS = new Set([
  'accounts',
  'about',
  'blog',
  'developer',
  'developers',
  'explore',
  'help',
  'legal',
  'popular',
  'web',
]);

const RESULT_LIMITS = {
  evidence: 1_000,
  phones: 20,
  emails: 20,
  hours: 100,
  images: 100,
  videos: 20,
  instagramPosts: 20,
  socialLinks: 20,
  services: 100,
  staff: 50,
  policyNotes: 50,
} as const;

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, 10_000) : null;
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? []
      : [value];
}

function evidenceValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function normalizeUrl(value: unknown, baseUrl: string): string | null {
  const raw = cleanText(value);
  if (!raw || raw.length > 4_096 || /^(?:data|blob|javascript):/i.test(raw)) return null;
  try {
    const url = new URL(raw, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.href;
  } catch {
    return null;
  }
}

function normalizePhone(value: unknown): { value: string; key: string } | null {
  const raw = cleanText(value)?.replace(/^tel:/i, '').split(/[?#]/, 1)[0];
  if (!raw) return null;
  let normalized = raw.replace(/[^\d+]/g, '');
  if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`;
  normalized = normalized.startsWith('+')
    ? `+${normalized.slice(1).replace(/\D/g, '')}`
    : normalized.replace(/\D/g, '');
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  const key =
    digits.startsWith('972') && digits.length >= 11 ? `0${digits.slice(3)}` : digits;
  return { value: normalized, key };
}

function normalizeEmail(value: unknown): string | null {
  const email = cleanText(value)
    ?.replace(/^mailto:/i, '')
    .split(/[?#]/, 1)[0]
    ?.toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function socialLink(value: unknown, baseUrl: string): BusinessImportSocialLink | null {
  const url = normalizeUrl(value, baseUrl);
  if (!url) return null;
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase().replace(/^www\.|^m\./, '');
  const match = SOCIAL_HOSTS.find(({ hosts }) =>
    hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)),
  );
  if (!match) return null;
  if (
    (match.platform === 'whatsapp' &&
      !/\d{8,}/.test(`${parsed.pathname}${parsed.searchParams.get('phone') ?? ''}`)) ||
    (match.platform === 'facebook' &&
      /^\/(?:sharer|share|dialog)(?:\/|$)/i.test(parsed.pathname)) ||
    (match.platform === 'instagram' &&
      /^\/(?:p|reel|stories)(?:\/|$)/i.test(parsed.pathname))
  ) {
    return null;
  }
  if (match.platform === 'instagram') {
    if (hostname !== 'instagram.com') return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (
      segments.length !== 1 ||
      RESERVED_INSTAGRAM_PATHS.has(segments[0]!.toLowerCase())
    ) {
      return null;
    }
    parsed.search = '';
    parsed.pathname = `/${segments[0]}/`;
  }
  if (
    match.platform === 'facebook' &&
    (hostname !== 'facebook.com' ||
      parsed.pathname === '/' ||
      /^\/(?:help|login|privacy|policies|sharer|share|dialog)(?:\/|$)/i.test(
        parsed.pathname,
      ))
  ) {
    return null;
  }
  if (match.platform === 'whatsapp') {
    const digits = `${parsed.pathname}${parsed.searchParams.get('phone') ?? ''}`.replace(
      /\D/g,
      '',
    );
    const normalizedDigits =
      digits.startsWith('9720') && digits.length > 11 ? `972${digits.slice(4)}` : digits;
    return { platform: 'whatsapp', url: `https://wa.me/${normalizedDigits}` };
  }
  return { platform: match.platform, url: parsed.href };
}

function imageUrl(
  value: unknown,
  baseUrl: string,
  dimensions?: { width?: number; height?: number },
): string | null {
  const url = normalizeUrl(value, baseUrl);
  if (!url) return null;
  if (
    (dimensions?.width !== undefined && dimensions.width <= 32) ||
    (dimensions?.height !== undefined && dimensions.height <= 32) ||
    /(?:^|[/_.-])(?:favicon|sprite|spacer|tracking|pixel|1x1|loader|spinner)(?:[/_.-]|$)/i.test(
      new URL(url).pathname,
    ) ||
    /\.svg(?:$|\?)/i.test(url)
  ) {
    return null;
  }
  return url;
}

function canonicalMediaKey(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid|oh|_nc_.+|ccb|stp|efg)$/i.test(key)) {
      url.searchParams.delete(key);
    }
  }
  url.pathname = url.pathname
    .replace(/\/opt\//, '/')
    .replace(/-(?:\d+)[wh](?=\.[a-z0-9]+$)/i, '');
  return url.href;
}

function confidenceForMethod(
  method: BusinessImportEvidenceMethod,
): BusinessImportEvidence['confidence'] {
  if (method === 'json-ld' || method === 'html-attribute' || method === 'link') {
    return 'high';
  }
  if (method === 'open-graph' || method === 'embedded-json' || method === 'canonical') {
    return 'medium';
  }
  return 'low';
}

function withEvidenceConfidence(
  evidence: BusinessImportEvidence,
): BusinessImportEvidence {
  return {
    ...evidence,
    confidence: evidence.confidence ?? confidenceForMethod(evidence.method),
  };
}

function firstUrl(value: unknown, baseUrl: string): string | null {
  for (const candidate of asArray(value)) {
    const record = asRecord(candidate);
    const url = normalizeUrl(record?.url ?? record?.contentUrl ?? candidate, baseUrl);
    if (url) return url;
  }
  return null;
}

function jsonLdTypes(node: JsonRecord): string[] {
  return asArray(node['@type'])
    .map(cleanText)
    .filter((value): value is string => Boolean(value))
    .map((value) => value.split('/').pop()!.toLowerCase());
}

function hasJsonLdType(node: JsonRecord, names: string[]): boolean {
  const types = jsonLdTypes(node);
  return names.some((name) => types.includes(name.toLowerCase()));
}

function collectJsonLdNodes(
  value: unknown,
  nodes: JsonRecord[],
  seen = new Set<object>(),
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdNodes(item, nodes, seen);
    return;
  }
  const record = asRecord(value);
  if (!record || seen.has(record)) return;
  seen.add(record);
  if (record['@type']) nodes.push(record);
  for (const child of Object.values(record)) {
    if (child && typeof child === 'object') collectJsonLdNodes(child, nodes, seen);
  }
}

function dayName(value: unknown): (typeof DAY_NAMES)[number] | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const token = raw
    .split('/')
    .pop()!
    .toLowerCase()
    .replace(/[.'״׳]/g, '');
  return DAY_ALIASES[token] ?? null;
}

function expandDayRange(start: string, end: string): string[] {
  const startDay = dayName(start);
  const endDay = dayName(end);
  if (!startDay || !endDay) return [];
  const values: string[] = [];
  let index = DAY_NAMES.indexOf(startDay);
  const endIndex = DAY_NAMES.indexOf(endDay);
  for (let count = 0; count < DAY_NAMES.length; count += 1) {
    values.push(DAY_NAMES[index]!);
    if (index === endIndex) break;
    index = (index + 1) % DAY_NAMES.length;
  }
  return values;
}

function parseDays(raw: string): string[] {
  const normalized = raw
    .replace(/[–—]/g, '-')
    .replace(/\bto\b/gi, '-')
    .replace(/\s+עד\s+/g, '-');
  const range = normalized.match(
    /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat|Su|Mo|Tu|We|Th|Fr|Sa|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|א|ב|ג|ד|ה|ו)\s*-\s*(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat|Su|Mo|Tu|We|Th|Fr|Sa|ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת|א|ב|ג|ד|ה|ו)/i,
  );
  if (range) return expandDayRange(range[1]!, range[2]!);

  const days = normalized
    .split(/[,/|]+/)
    .flatMap((part) => part.trim().split(/\s+/))
    .map(dayName)
    .filter((value): value is (typeof DAY_NAMES)[number] => Boolean(value));
  return [...new Set(days)];
}

function parseHoursText(
  rawValue: unknown,
  sourceUrl: string,
): BusinessImportHours | null {
  const raw = cleanText(rawValue);
  if (!raw) return null;
  const times = [...raw.matchAll(/([01]?\d|2[0-3]):([0-5]\d)/g)].map(
    (match) => `${match[1]!.padStart(2, '0')}:${match[2]}`,
  );
  const days = parseDays(raw);
  if (days.length === 0 && times.length < 2) return null;
  return {
    dayOfWeek: days,
    opens: times[0] ?? null,
    closes: times[1] ?? null,
    raw,
    sourceUrl,
  };
}

function parseDurationMinutes(value: unknown): number | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const iso = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i.exec(raw);
  if (iso) {
    const minutes =
      Number(iso[1] ?? 0) * 24 * 60 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0);
    return minutes > 0 ? minutes : null;
  }
  const hours = /(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|שעות?|שעה)/i.exec(raw);
  const minutes = /(\d+)\s*(?:minutes?|mins?|דק(?:ות|['׳])?)/i.exec(raw);
  const total =
    (hours ? Number(hours[1]!.replace(',', '.')) * 60 : 0) +
    (minutes ? Number(minutes[1]) : 0);
  return total > 0 && Number.isFinite(total) ? Math.round(total) : null;
}

function parsePrice(
  value: unknown,
  explicitCurrency?: unknown,
): { price: number | null; currency: string | null } {
  const raw = cleanText(value);
  const currencyRaw = cleanText(explicitCurrency)?.toUpperCase();
  let currency =
    currencyRaw ??
    (raw?.includes('₪')
      ? 'ILS'
      : /\b(?:ILS|NIS)\b/i.test(raw ?? '')
        ? 'ILS'
        : raw?.includes('€')
          ? 'EUR'
          : /\bEUR\b/i.test(raw ?? '')
            ? 'EUR'
            : raw?.includes('$') || /\bUSD\b/i.test(raw ?? '')
              ? 'USD'
              : null);
  if (currency === 'NIS') currency = 'ILS';
  const numberText = raw?.match(/\d[\d.,\s]*/)?.[0]?.replace(/\s/g, '');
  if (!numberText) return { price: null, currency };
  let normalized = numberText;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized =
      normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
        ? normalized.replace(/\./g, '').replace(',', '.')
        : normalized.replace(/,/g, '');
  } else if (/,\d{1,2}$/.test(normalized)) {
    normalized = normalized.replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }
  const price = Number(normalized);
  return { price: Number.isFinite(price) ? price : null, currency };
}

function cleanedPlatformTitle(
  value: string,
  sourceType: BusinessImportSourceType,
): string {
  if (sourceType === 'instagram') {
    return value
      .replace(/\s*\(@[^)]+\).*$/i, '')
      .replace(/\s*[•|]\s*Instagram.*$/i, '')
      .trim();
  }
  if (sourceType === 'facebook')
    return value.replace(/\s*[|•]\s*Facebook.*$/i, '').trim();
  return value.trim();
}

function cleanedPlatformDescription(
  value: string,
  sourceType: BusinessImportSourceType,
): string {
  if (sourceType !== 'instagram') return value.trim();
  const quotedBio = /on Instagram:\s*["“](.+)["”]\s*$/is.exec(value)?.[1];
  const withoutStats = (quotedBio ?? value).replace(
    /^\s*[\d,.]+\s+Followers?,\s*[\d,.]+\s+Following,\s*[\d,.]+\s+Posts?\s*-\s*/i,
    '',
  );
  return withoutStats.replace(/\\n/g, '\n').trim();
}

function extractInstagramProfileMetadata(
  builder: DraftBuilder,
  rawDescription: string | null,
  pageUrl: string,
): void {
  if (!rawDescription) return;
  const description = cleanedPlatformDescription(rawDescription, 'instagram');
  builder.setBusiness('description', description, pageUrl, 'meta', 95);
  extractContactsFromText(builder, description, pageUrl, 'meta');

  const location = /(?:📍|location\s*:?)\s*([^\n|]+)/i.exec(description)?.[1]?.trim();
  const city = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /\|\s*[\u0590-\u05ff][\u0590-\u05ff\s]+$/.test(line))
    ?.split('|')
    .at(-1)
    ?.trim();
  if (location) {
    const formatted =
      city && !location.includes(city) ? `${location}, ${city}` : location;
    builder.setLocation('formattedAddress', formatted, pageUrl, 'meta', 90);
    if (city) builder.setLocation('locality', city, pageUrl, 'meta', 85);
  }
}

function looksLikeLogoUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    return /(?:^|[/_.+\s-])(?:logo|לוגו)(?:[/_.+\s-]|$)/i.test(
      decodeURIComponent(new URL(value).pathname),
    );
  } catch {
    return false;
  }
}

function extractContactsFromText(
  builder: DraftBuilder,
  text: string,
  sourceUrl: string,
  method: BusinessImportEvidenceMethod,
): void {
  for (const email of text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []) {
    builder.addEmail(email, sourceUrl, method);
  }
  for (const phone of [
    ...(text.match(/\+\d(?:[\d\s().-]{6,}\d)/g) ?? []),
    ...(text.match(/(?<!\d)0\d(?:[\s().-]*\d){7,13}(?!\d)/g) ?? []),
  ]) {
    builder.addPhone(phone, sourceUrl, method);
  }
}

function sourceTypeSuggestion(text: string): TorChickBusinessType | null {
  const rules: Array<[TorChickBusinessType, RegExp]> = [
    ['BARBERSHOP', /\bbarber(?:shop)?\b|ספר(?:ות)? גברים|ברבר/i],
    ['NAILS', /\bnails?\b|manicure|pedicure|ציפורנ|מניקור|פדיקור/i],
    ['BROWS_LASHES', /\bbrows?\b|\blashes?\b|גבות|ריסים/i],
    ['TATTOO_PIERCING', /tattoo|piercing|קעקוע|פירסינג/i],
    ['SPA_MASSAGE', /\bspa\b|massage|עיסוי|ספא/i],
    ['FITNESS', /fitness|\bgym\b|personal trainer|כושר|אימון אישי/i],
    ['CLINIC', /clinic|medical|doctor|dental|מרפאה|רפואה|רופא|שיניים/i],
    ['BEAUTY_COSMETICS', /beauty|cosmetic|aesthetic|קוסמט|אסתטיקה|טיפוח/i],
    ['HAIR_SALON', /hair|salon|hairdress|מספרה|עיצוב שיער/i],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function srcsetUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;
  const candidates = value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter((part): part is string => Boolean(part));
  return candidates.length ? imageUrl(candidates.at(-1), baseUrl) : null;
}

function addressText(address: JsonRecord): string | null {
  return cleanText(
    [
      address.streetAddress,
      address.addressLocality,
      address.addressRegion,
      address.postalCode,
      address.addressCountry,
    ]
      .map(cleanText)
      .filter(Boolean)
      .join(', '),
  );
}

function uniqueKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

class DraftBuilder {
  readonly draft: BusinessImportDraft;
  private readonly scalarScores = new Map<string, number>();
  private readonly evidenceKeys = new Set<string>();
  private readonly phoneKeys = new Set<string>();
  private readonly emailKeys = new Set<string>();
  private readonly hourKeys = new Set<string>();
  private readonly imageKeys = new Set<string>();
  private readonly videoKeys = new Set<string>();
  private readonly instagramPostKeys = new Set<string>();
  private readonly socialKeys = new Set<string>();
  private readonly serviceIndexes = new Map<string, number>();
  private readonly staffIndexes = new Map<string, number>();
  private readonly policyNoteKeys = new Set<string>();
  private readonly truncatedFields = new Set<string>();

  constructor(
    sourceType: BusinessImportSourceType,
    sourceUrl: string,
    fetchedUrls: string[],
  ) {
    this.draft = {
      sourceType,
      sourceUrl,
      fetchedUrls,
      business: {
        name: null,
        description: null,
        industry: null,
        category: null,
        typeSuggestion: null,
        websiteUrl: null,
      },
      contacts: { phones: [], emails: [] },
      location: {
        formattedAddress: null,
        streetAddress: null,
        locality: null,
        region: null,
        postalCode: null,
        country: null,
        mapUrl: null,
      },
      hours: [],
      services: [],
      staff: [],
      bookingPolicy: {
        minLeadTimeMinutes: null,
        cancellationWindowHours: null,
        maxAdvanceBookingDays: null,
        bookingRequiresApproval: null,
        notes: [],
      },
      media: {
        logoUrl: null,
        coverImageUrl: null,
        galleryImageUrls: [],
        videoUrls: [],
        instagramPostUrls: [],
      },
      socialLinks: [],
      evidence: [],
      warnings: [],
    };
  }

  addEvidence(evidence: BusinessImportEvidence): void {
    const normalizedEvidence = withEvidenceConfidence(evidence);
    const key = [
      normalizedEvidence.field,
      normalizedEvidence.value,
      normalizedEvidence.sourceUrl,
      normalizedEvidence.method,
      normalizedEvidence.detail ?? '',
    ].join('\u0000');
    if (this.evidenceKeys.has(key)) return;
    if (this.draft.evidence.length >= RESULT_LIMITS.evidence) {
      this.markTruncated('evidence', RESULT_LIMITS.evidence);
      return;
    }
    this.evidenceKeys.add(key);
    this.draft.evidence.push(normalizedEvidence);
  }

  private markTruncated(field: string, limit: number): void {
    if (this.truncatedFields.has(field)) return;
    this.truncatedFields.add(field);
    this.addWarning({
      code: 'result-truncated',
      message: `Only the first ${limit} ${field} values were retained for review.`,
      sourceUrl: this.draft.sourceUrl,
    });
  }

  addWarning(warning: BusinessImportDraft['warnings'][number]): void {
    if (
      this.draft.warnings.some(
        (existing) =>
          existing.code === warning.code &&
          existing.sourceUrl === warning.sourceUrl &&
          existing.message === warning.message,
      )
    ) {
      return;
    }
    this.draft.warnings.push(warning);
  }

  setBusiness(
    field: keyof BusinessImportDraft['business'],
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
    score: number,
    detail?: string,
  ): void {
    const cleaned = cleanText(value);
    if (!cleaned || score <= (this.scalarScores.get(`business.${field}`) ?? -1)) return;
    this.scalarScores.set(`business.${field}`, score);
    this.draft.business[field] = cleaned as never;
    this.addEvidence({
      field: `business.${field}`,
      value: cleaned,
      sourceUrl,
      method,
      detail,
    });
  }

  setLocation(
    field: keyof BusinessImportDraft['location'],
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
    score: number,
  ): void {
    const cleaned = cleanText(value);
    if (!cleaned || score <= (this.scalarScores.get(`location.${field}`) ?? -1)) return;
    this.scalarScores.set(`location.${field}`, score);
    this.draft.location[field] = cleaned;
    this.addEvidence({
      field: `location.${field}`,
      value: cleaned,
      sourceUrl,
      method,
    });
  }

  setMedia(
    field: 'logoUrl' | 'coverImageUrl',
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
    score: number,
  ): void {
    const url = imageUrl(value, sourceUrl);
    if (!url || score <= (this.scalarScores.get(`media.${field}`) ?? -1)) return;
    this.scalarScores.set(`media.${field}`, score);
    this.draft.media[field] = url;
    this.addEvidence({ field: `media.${field}`, value: url, sourceUrl, method });
  }

  addPhone(
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
  ): void {
    const phone = normalizePhone(value);
    if (!phone || this.phoneKeys.has(phone.key)) return;
    if (this.draft.contacts.phones.length >= RESULT_LIMITS.phones) {
      this.markTruncated('phone', RESULT_LIMITS.phones);
      return;
    }
    this.phoneKeys.add(phone.key);
    this.draft.contacts.phones.push(phone.value);
    this.addEvidence({
      field: 'contacts.phones',
      value: phone.value,
      sourceUrl,
      method,
    });
  }

  addEmail(
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
  ): void {
    const email = normalizeEmail(value);
    if (!email || this.emailKeys.has(email)) return;
    if (this.draft.contacts.emails.length >= RESULT_LIMITS.emails) {
      this.markTruncated('email', RESULT_LIMITS.emails);
      return;
    }
    this.emailKeys.add(email);
    this.draft.contacts.emails.push(email);
    this.addEvidence({
      field: 'contacts.emails',
      value: email,
      sourceUrl,
      method,
    });
  }

  addHours(
    hours: BusinessImportHours | null,
    method: BusinessImportEvidenceMethod,
  ): void {
    if (!hours) return;
    const key = uniqueKey(
      `${hours.dayOfWeek.join(',')}|${hours.opens}|${hours.closes}|${hours.raw}`,
    );
    if (this.hourKeys.has(key)) return;
    if (this.draft.hours.length >= RESULT_LIMITS.hours) {
      this.markTruncated('hours', RESULT_LIMITS.hours);
      return;
    }
    this.hourKeys.add(key);
    this.draft.hours.push(hours);
    this.addEvidence({
      field: 'hours',
      value: hours.raw,
      sourceUrl: hours.sourceUrl,
      method,
    });
  }

  addImage(
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
  ): void {
    const url = imageUrl(value, sourceUrl);
    if (!url) return;
    const key = canonicalMediaKey(url);
    if (this.imageKeys.has(key)) return;
    if (this.draft.media.galleryImageUrls.length >= RESULT_LIMITS.images) {
      this.markTruncated('image', RESULT_LIMITS.images);
      return;
    }
    this.imageKeys.add(key);
    this.draft.media.galleryImageUrls.push(url);
    this.addEvidence({
      field: 'media.galleryImageUrls',
      value: url,
      sourceUrl,
      method,
    });
  }

  addVideo(
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
  ): void {
    const url = normalizeUrl(value, sourceUrl);
    if (
      !url ||
      (!isDirectVideoUrl(url) && !isSupportedSocialVideoUrl(url)) ||
      this.videoKeys.has(url)
    ) {
      return;
    }
    if (this.draft.media.videoUrls.length >= RESULT_LIMITS.videos) {
      this.markTruncated('video', RESULT_LIMITS.videos);
      return;
    }
    this.videoKeys.add(url);
    this.draft.media.videoUrls.push(url);
    this.addEvidence({
      field: 'media.videoUrls',
      value: url,
      sourceUrl,
      method,
    });
  }

  addInstagramPost(
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
    expectedProfile?: string,
  ): void {
    const raw = cleanText(value);
    if (!raw) return;
    const url = normalizeInstagramPostUrl(raw, sourceUrl, expectedProfile);
    if (!url) return;
    const key = canonicalMediaKey(url);
    if (this.instagramPostKeys.has(key)) return;
    if (this.draft.media.instagramPostUrls.length >= RESULT_LIMITS.instagramPosts) {
      this.markTruncated('Instagram post', RESULT_LIMITS.instagramPosts);
      return;
    }
    this.instagramPostKeys.add(key);
    this.draft.media.instagramPostUrls.push(url);
    this.addEvidence({
      field: 'media.instagramPostUrls',
      value: url,
      sourceUrl,
      method,
    });
  }

  addSocial(
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
    expectedInstagramProfile?: string,
  ): void {
    const link = socialLink(value, sourceUrl);
    if (!link) return;
    if (link.platform === 'instagram' && expectedInstagramProfile) {
      const profile = new URL(link.url).pathname.split('/').filter(Boolean)[0];
      if (profile?.toLowerCase() !== expectedInstagramProfile.toLowerCase()) return;
    }
    const key = `${link.platform}:${link.url}`;
    if (this.socialKeys.has(key)) return;
    if (this.draft.socialLinks.length >= RESULT_LIMITS.socialLinks) {
      this.markTruncated('social link', RESULT_LIMITS.socialLinks);
      return;
    }
    this.socialKeys.add(key);
    this.draft.socialLinks.push(link);
    this.addEvidence({
      field: 'socialLinks',
      value: `${link.platform}:${link.url}`,
      sourceUrl,
      method,
    });
  }

  addService(service: BusinessImportService): void {
    const normalizedService = {
      ...service,
      evidence: service.evidence.map(withEvidenceConfidence),
    };
    const key = uniqueKey(service.name);
    const existingIndex = this.serviceIndexes.get(key);
    if (existingIndex === undefined) {
      if (this.draft.services.length >= RESULT_LIMITS.services) {
        this.markTruncated('service', RESULT_LIMITS.services);
        return;
      }
      this.serviceIndexes.set(key, this.draft.services.length);
      this.draft.services.push(normalizedService);
      for (const evidence of normalizedService.evidence) this.addEvidence(evidence);
      return;
    }
    const existing = this.draft.services[existingIndex]!;
    existing.description ??= normalizedService.description;
    existing.price ??= normalizedService.price;
    existing.currency ??= normalizedService.currency;
    existing.durationMinutes ??= normalizedService.durationMinutes;
    existing.imageUrl ??= normalizedService.imageUrl;
    for (const evidence of normalizedService.evidence) {
      if (
        !existing.evidence.some(
          (item) =>
            item.field === evidence.field &&
            item.value === evidence.value &&
            item.sourceUrl === evidence.sourceUrl &&
            item.method === evidence.method,
        )
      ) {
        existing.evidence.push(evidence);
      }
      this.addEvidence(evidence);
    }
  }

  addStaff(member: BusinessImportStaff): void {
    const normalizedMember = {
      ...member,
      evidence: member.evidence.map(withEvidenceConfidence),
    };
    const key = uniqueKey(member.name);
    const existingIndex = this.staffIndexes.get(key);
    if (existingIndex === undefined) {
      if (this.draft.staff.length >= RESULT_LIMITS.staff) {
        this.markTruncated('staff', RESULT_LIMITS.staff);
        return;
      }
      this.staffIndexes.set(key, this.draft.staff.length);
      this.draft.staff.push(normalizedMember);
      for (const evidence of normalizedMember.evidence) this.addEvidence(evidence);
      return;
    }
    const existing = this.draft.staff[existingIndex]!;
    existing.title ??= normalizedMember.title;
    existing.bio ??= normalizedMember.bio;
    existing.imageUrl ??= normalizedMember.imageUrl;
    existing.serviceNames = [
      ...new Set([...existing.serviceNames, ...normalizedMember.serviceNames]),
    ];
    for (const evidence of normalizedMember.evidence) {
      if (
        !existing.evidence.some(
          (item) =>
            item.field === evidence.field &&
            item.value === evidence.value &&
            item.sourceUrl === evidence.sourceUrl &&
            item.method === evidence.method,
        )
      ) {
        existing.evidence.push(evidence);
      }
      this.addEvidence(evidence);
    }
  }

  setPolicy(
    field:
      | 'minLeadTimeMinutes'
      | 'cancellationWindowHours'
      | 'maxAdvanceBookingDays'
      | 'bookingRequiresApproval',
    value: number | boolean | null,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
    score: number,
    raw: string,
  ): void {
    if (
      value === null ||
      score <= (this.scalarScores.get(`bookingPolicy.${field}`) ?? -1)
    ) {
      return;
    }
    this.scalarScores.set(`bookingPolicy.${field}`, score);
    this.draft.bookingPolicy[field] = value as never;
    this.addEvidence({
      field: `bookingPolicy.${field}`,
      value: String(value),
      sourceUrl,
      method,
      detail: raw,
    });
  }

  addPolicyNote(
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
  ): void {
    const note = cleanText(value);
    if (!note) return;
    const key = uniqueKey(note);
    if (this.policyNoteKeys.has(key)) return;
    if (this.draft.bookingPolicy.notes.length >= RESULT_LIMITS.policyNotes) {
      this.markTruncated('policy note', RESULT_LIMITS.policyNotes);
      return;
    }
    this.policyNoteKeys.add(key);
    this.draft.bookingPolicy.notes.push(note);
    this.addEvidence({
      field: 'bookingPolicy.notes',
      value: note,
      sourceUrl,
      method,
    });
  }
}

function serviceEvidence(
  name: string,
  field: string,
  value: unknown,
  sourceUrl: string,
  method: BusinessImportEvidenceMethod,
): BusinessImportEvidence {
  return {
    field: `services.${uniqueKey(name)}.${field}`,
    value: evidenceValue(value),
    sourceUrl,
    method,
  };
}

function staffEvidence(
  name: string,
  field: string,
  value: unknown,
  sourceUrl: string,
  method: BusinessImportEvidenceMethod,
): BusinessImportEvidence {
  return {
    field: `staff.${uniqueKey(name)}.${field}`,
    value: evidenceValue(value),
    sourceUrl,
    method,
  };
}

function staffFromRecord(
  node: JsonRecord,
  pageUrl: string,
  method: BusinessImportEvidenceMethod,
): BusinessImportStaff | null {
  const name = cleanText(node.name ?? node.displayName ?? node.fullName);
  if (!name || name.length > 120) return null;
  const title = cleanText(node.jobTitle ?? node.title ?? node.role);
  const bio = cleanText(node.description ?? node.bio ?? node.about);
  const image = firstUrl(node.image ?? node.avatar ?? node.photo, pageUrl);
  const serviceNames = asArray(node.services ?? node.serviceNames ?? node.specialties)
    .map((value) => cleanText(asRecord(value)?.name ?? value))
    .filter((value): value is string => Boolean(value))
    .slice(0, 50);
  const evidence = [staffEvidence(name, 'name', name, pageUrl, method)];
  if (title) evidence.push(staffEvidence(name, 'title', title, pageUrl, method));
  if (bio) evidence.push(staffEvidence(name, 'bio', bio, pageUrl, method));
  if (image) evidence.push(staffEvidence(name, 'imageUrl', image, pageUrl, method));
  for (const serviceName of serviceNames) {
    evidence.push(staffEvidence(name, 'serviceNames', serviceName, pageUrl, method));
  }
  return {
    name,
    title,
    bio,
    imageUrl: image,
    serviceNames,
    sourceUrl: pageUrl,
    evidence,
  };
}

function serviceFromRecord(
  node: JsonRecord,
  pageUrl: string,
  method: BusinessImportEvidenceMethod = 'json-ld',
): BusinessImportService | null {
  const item = asRecord(node.item) ?? asRecord(node.itemOffered) ?? node;
  const offers = asRecord(asArray(item.offers)[0]) ?? asRecord(asArray(node.offers)[0]);
  const name = cleanText(item.name ?? node.name);
  if (!name) return null;
  const description = cleanText(item.description ?? node.description);
  const { price, currency } = parsePrice(
    offers?.price ?? offers?.lowPrice ?? item.price ?? node.price,
    offers?.priceCurrency ?? item.priceCurrency ?? node.priceCurrency,
  );
  const durationMinutes = parseDurationMinutes(
    item.duration ?? item.timeRequired ?? item.estimatedDuration ?? node.duration,
  );
  const image = firstUrl(item.image ?? node.image, pageUrl);
  const sourceUrl = normalizeUrl(item.url ?? node.url ?? offers?.url, pageUrl) ?? pageUrl;
  const evidence: BusinessImportEvidence[] = [
    serviceEvidence(name, 'name', name, pageUrl, method),
  ];
  if (description)
    evidence.push(serviceEvidence(name, 'description', description, pageUrl, method));
  if (price !== null)
    evidence.push(serviceEvidence(name, 'price', price, pageUrl, method));
  if (currency)
    evidence.push(serviceEvidence(name, 'currency', currency, pageUrl, method));
  if (durationMinutes !== null) {
    evidence.push(
      serviceEvidence(name, 'durationMinutes', durationMinutes, pageUrl, method),
    );
  }
  if (image) evidence.push(serviceEvidence(name, 'imageUrl', image, pageUrl, method));
  return {
    name,
    description,
    price,
    currency,
    durationMinutes,
    imageUrl: image,
    sourceUrl,
    evidence,
  };
}

function extractBusinessJsonLd(
  builder: DraftBuilder,
  nodes: JsonRecord[],
  pageUrl: string,
): void {
  const localBusinessNode = [
    'LocalBusiness',
    'ProfessionalService',
    'HealthAndBeautyBusiness',
    'MedicalBusiness',
    'BeautySalon',
    'HairSalon',
    'NailSalon',
    'DaySpa',
    'TattooParlor',
    'Dentist',
    'Physician',
    'HealthClub',
    'SportsActivityLocation',
    'Store',
  ]
    .map((type) => nodes.find((node) => hasJsonLdType(node, [type])))
    .find((node): node is JsonRecord => Boolean(node));
  const organizationNode = nodes.find((node) => hasJsonLdType(node, ['Organization']));
  const organizationName = cleanText(organizationNode?.name);
  const businessNode =
    localBusinessNode ??
    (organizationNode &&
    (!builder.draft.business.name ||
      uniqueKey(organizationName ?? '') === uniqueKey(builder.draft.business.name))
      ? organizationNode
      : undefined);
  if (businessNode) {
    builder.setBusiness('name', cleanText(businessNode.name), pageUrl, 'json-ld', 100);
    builder.setBusiness(
      'description',
      cleanText(businessNode.description),
      pageUrl,
      'json-ld',
      100,
    );
    builder.setBusiness(
      'industry',
      cleanText(businessNode.industry),
      pageUrl,
      'json-ld',
      100,
    );
    builder.setBusiness(
      'category',
      cleanText(businessNode.category ?? businessNode.additionalType),
      pageUrl,
      'json-ld',
      100,
    );
    const website = normalizeUrl(businessNode.url, pageUrl);
    if (website && !socialLink(website, pageUrl)) {
      builder.setBusiness('websiteUrl', website, pageUrl, 'json-ld', 100);
    }
    builder.addPhone(businessNode.telephone, pageUrl, 'json-ld');
    builder.addEmail(businessNode.email, pageUrl, 'json-ld');
    const mapUrl = normalizeUrl(
      businessNode.hasMap ?? businessNode.map ?? businessNode.maps,
      pageUrl,
    );
    builder.setLocation('mapUrl', mapUrl, pageUrl, 'json-ld', 100);
    for (const link of asArray(businessNode.sameAs)) {
      builder.addSocial(link, pageUrl, 'json-ld');
    }
    for (const rawStaff of [
      ...asArray(businessNode.employee),
      ...asArray(businessNode.founder),
      ...asArray(businessNode.member),
    ]) {
      const member = staffFromRecord(
        asRecord(rawStaff) ?? { name: rawStaff },
        pageUrl,
        'json-ld',
      );
      if (member) builder.addStaff(member);
    }

    const address = asRecord(businessNode.address);
    if (address) {
      builder.setLocation(
        'formattedAddress',
        cleanText(address.name) ?? addressText(address),
        pageUrl,
        'json-ld',
        100,
      );
      builder.setLocation(
        'streetAddress',
        address.streetAddress,
        pageUrl,
        'json-ld',
        100,
      );
      builder.setLocation('locality', address.addressLocality, pageUrl, 'json-ld', 100);
      builder.setLocation('region', address.addressRegion, pageUrl, 'json-ld', 100);
      builder.setLocation('postalCode', address.postalCode, pageUrl, 'json-ld', 100);
      builder.setLocation('country', address.addressCountry, pageUrl, 'json-ld', 100);
    } else {
      builder.setLocation(
        'formattedAddress',
        businessNode.address,
        pageUrl,
        'json-ld',
        95,
      );
    }

    for (const raw of asArray(businessNode.openingHours)) {
      builder.addHours(parseHoursText(raw, pageUrl), 'json-ld');
    }
    for (const rawSpec of asArray(businessNode.openingHoursSpecification)) {
      const spec = asRecord(rawSpec);
      if (!spec) continue;
      const days = asArray(spec.dayOfWeek)
        .map(dayName)
        .filter((value): value is (typeof DAY_NAMES)[number] => Boolean(value));
      const opens = cleanText(spec.opens);
      const closes = cleanText(spec.closes);
      const raw = `${days.join(', ')} ${opens ?? ''}-${closes ?? ''}`.trim();
      builder.addHours(
        {
          dayOfWeek: [...new Set(days)],
          opens,
          closes,
          raw,
          sourceUrl: pageUrl,
        },
        'json-ld',
      );
    }

    const logo = firstUrl(businessNode.logo, pageUrl);
    const images = asArray(businessNode.image)
      .map((value) => firstUrl(value, pageUrl))
      .filter((value): value is string => Boolean(value));
    builder.setMedia('logoUrl', logo, pageUrl, 'json-ld', 100);
    builder.setMedia('coverImageUrl', images[0], pageUrl, 'json-ld', 90);
    for (const image of images) builder.addImage(image, pageUrl, 'json-ld');
    for (const video of asArray(businessNode.video)) {
      builder.addVideo(firstUrl(video, pageUrl), pageUrl, 'json-ld');
    }
  }

  for (const node of nodes) {
    if (hasJsonLdType(node, ['Service', 'Product', 'Offer'])) {
      const service = serviceFromRecord(node, pageUrl);
      if (service) builder.addService(service);
    }
    if (hasJsonLdType(node, ['OfferCatalog'])) {
      for (const entry of asArray(node.itemListElement)) {
        const record = asRecord(entry);
        if (!record) continue;
        const service = serviceFromRecord(record, pageUrl);
        if (service) builder.addService(service);
      }
    }
  }
}

function metaValues($: CheerioAPI): Map<string, string[]> {
  const values = new Map<string, string[]>();
  $('meta').each((_index, element) => {
    const key = (
      $(element).attr('property') ??
      $(element).attr('name') ??
      ''
    ).toLowerCase();
    const value = cleanText($(element).attr('content'));
    if (!key || !value) return;
    values.set(key, [...(values.get(key) ?? []), value]);
  });
  return values;
}

function firstMeta(meta: Map<string, string[]>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = meta.get(key)?.[0];
    if (value) return value;
  }
  return null;
}

function extractMetadata(
  builder: DraftBuilder,
  $: CheerioAPI,
  pageUrl: string,
  sourceType: BusinessImportSourceType,
): void {
  const meta = metaValues($);
  const rawDescription =
    $('meta[name="description"]').first().attr('content') ??
    $('meta[property="og:description"]').first().attr('content') ??
    null;
  const title =
    firstMeta(meta, 'og:site_name') ??
    firstMeta(meta, 'og:title', 'twitter:title') ??
    cleanText($('h1').first().text()) ??
    cleanText($('title').text());
  if (title) {
    builder.setBusiness(
      'name',
      cleanedPlatformTitle(title, sourceType),
      pageUrl,
      firstMeta(meta, 'og:site_name', 'og:title') ? 'open-graph' : 'visible-text',
      firstMeta(meta, 'og:site_name') ? 85 : 70,
    );
  }
  const description =
    sourceType === 'instagram'
      ? cleanText(cleanedPlatformDescription(rawDescription ?? '', sourceType))
      : firstMeta(meta, 'og:description', 'description', 'twitter:description');
  if (sourceType === 'instagram') {
    extractInstagramProfileMetadata(builder, rawDescription, pageUrl);
  } else {
    builder.setBusiness(
      'description',
      description,
      pageUrl,
      meta.has('og:description') ? 'open-graph' : 'meta',
      80,
    );
  }
  extractContactsFromText(
    builder,
    [title, description].filter(Boolean).join(' '),
    pageUrl,
    'meta',
  );

  const canonical =
    normalizeUrl($('link[rel~="canonical"]').first().attr('href'), pageUrl) ??
    normalizeUrl(firstMeta(meta, 'og:url'), pageUrl);
  if (canonical && !socialLink(canonical, pageUrl)) {
    builder.setBusiness(
      'websiteUrl',
      canonical,
      pageUrl,
      $('link[rel~="canonical"]').length ? 'canonical' : 'open-graph',
      80,
    );
  }

  const ogImage = firstMeta(meta, 'og:image', 'og:image:url', 'twitter:image');
  if (sourceType === 'instagram' || looksLikeLogoUrl(ogImage)) {
    builder.setMedia('logoUrl', ogImage, pageUrl, 'open-graph', 85);
  } else {
    builder.setMedia('coverImageUrl', ogImage, pageUrl, 'open-graph', 80);
  }
  builder.addImage(ogImage, pageUrl, 'open-graph');
  builder.setMedia('logoUrl', firstMeta(meta, 'og:logo'), pageUrl, 'open-graph', 75);
  for (const video of [
    ...asArray(meta.get('og:video')),
    ...asArray(meta.get('og:video:url')),
  ]) {
    builder.addVideo(video, pageUrl, 'open-graph');
  }
}

function extractPolicyText(builder: DraftBuilder, raw: string, pageUrl: string): void {
  const text = cleanText(raw);
  if (!text || text.length > 600) return;
  const cancellation = /(?:ביטול|cancel(?:lation)?)\D{0,40}(\d+)\s*(שעות?|hours?)/i.exec(
    text,
  );
  if (cancellation) {
    builder.setPolicy(
      'cancellationWindowHours',
      Number(cancellation[1]),
      pageUrl,
      'visible-text',
      70,
      text,
    );
    builder.addPolicyNote(text, pageUrl, 'visible-text');
  }
  const leadHours =
    /(?:לקבוע|הזמנה|תור|book(?:ing)?)\D{0,50}(?:לפחות|minimum|at least)\s*(\d+)\s*(שעות?|hours?)/i.exec(
      text,
    );
  if (leadHours) {
    builder.setPolicy(
      'minLeadTimeMinutes',
      Number(leadHours[1]) * 60,
      pageUrl,
      'visible-text',
      70,
      text,
    );
    builder.addPolicyNote(text, pageUrl, 'visible-text');
  }
  const advanceDays =
    /(?:עד|maximum|up to)\s*(\d+)\s*(?:ימים|days)\s*(?:מראש|ahead|in advance)/i.exec(
      text,
    );
  if (advanceDays) {
    builder.setPolicy(
      'maxAdvanceBookingDays',
      Number(advanceDays[1]),
      pageUrl,
      'visible-text',
      70,
      text,
    );
    builder.addPolicyNote(text, pageUrl, 'visible-text');
  }
  if (
    /(?:דורש|נדרש|requires?)\s+(?:אישור|approval)|(?:אישור|approval)\s+(?:העסק|manual)/i.test(
      text,
    )
  ) {
    builder.setPolicy('bookingRequiresApproval', true, pageUrl, 'visible-text', 65, text);
    builder.addPolicyNote(text, pageUrl, 'visible-text');
  }
}

function serviceSectionLikely($: CheerioAPI, pageUrl: string): boolean {
  const path = new URL(pageUrl).pathname;
  if (/service|treatment|menu|price|טיפול|שירות/i.test(decodeURIComponent(path))) {
    return true;
  }
  return $('h1,h2')
    .toArray()
    .some((element) => /services|treatments|השירותים|הטיפולים/i.test($(element).text()));
}

function extractSemanticServices(
  builder: DraftBuilder,
  $: CheerioAPI,
  pageUrl: string,
): void {
  if (!serviceSectionLikely($, pageUrl)) return;
  $('h2,h3,h4').each((_index, element) => {
    const heading = cleanText($(element).text());
    if (
      !heading ||
      heading.length > 140 ||
      GENERIC_SERVICE_HEADINGS.has(uniqueKey(heading))
    ) {
      return;
    }
    const container = $(element).closest(
      '[data-auto="flex-element-group"],[data-service],article,li,section',
    );
    const scope = container.length ? container : $(element).parent();
    const text = cleanText(scope.text());
    if (!text || text.length > 1_500) return;
    const description =
      scope
        .find('p')
        .toArray()
        .map((item) => cleanText($(item).text()))
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .slice(0, 1_000) || null;
    const { price, currency } = parsePrice(text);
    const durationMinutes = parseDurationMinutes(text);
    const imageElement = scope.find('img').first();
    const image = imageUrl(
      imageElement.attr('data-dm-image-path') ??
        imageElement.attr('src') ??
        imageElement.attr('data-src'),
      pageUrl,
    );
    const evidence = [serviceEvidence(heading, 'name', heading, pageUrl, 'visible-text')];
    if (description) {
      evidence.push(
        serviceEvidence(heading, 'description', description, pageUrl, 'visible-text'),
      );
    }
    if (price !== null) {
      evidence.push(serviceEvidence(heading, 'price', price, pageUrl, 'visible-text'));
    }
    if (currency) {
      evidence.push(
        serviceEvidence(heading, 'currency', currency, pageUrl, 'visible-text'),
      );
    }
    if (durationMinutes !== null) {
      evidence.push(
        serviceEvidence(
          heading,
          'durationMinutes',
          durationMinutes,
          pageUrl,
          'visible-text',
        ),
      );
    }
    if (image) {
      evidence.push(
        serviceEvidence(heading, 'imageUrl', image, pageUrl, 'html-attribute'),
      );
    }
    builder.addService({
      name: heading,
      description,
      price,
      currency,
      durationMinutes,
      imageUrl: image,
      sourceUrl: pageUrl,
      evidence,
    });
  });
}

function firstRecordValue(record: JsonRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function extractEmbeddedJson(
  builder: DraftBuilder,
  $: CheerioAPI,
  pageUrl: string,
): void {
  const visited = new Set<object>();
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, path);
      return;
    }
    const record = asRecord(value);
    if (!record || visited.has(record)) return;
    visited.add(record);

    const context = path.toLowerCase();
    const businessContext = /business|company|merchant|profile|venue|salon/.test(context);
    if (businessContext) {
      builder.setBusiness(
        'name',
        firstRecordValue(record, ['businessName', 'companyName', 'displayName', 'name']),
        pageUrl,
        'embedded-json',
        65,
      );
      builder.setBusiness(
        'description',
        firstRecordValue(record, ['description', 'about', 'bio']),
        pageUrl,
        'embedded-json',
        65,
      );
      builder.setBusiness(
        'category',
        firstRecordValue(record, ['category', 'businessCategory']),
        pageUrl,
        'embedded-json',
        65,
      );
      builder.addPhone(
        firstRecordValue(record, ['phone', 'telephone', 'phoneNumber']),
        pageUrl,
        'embedded-json',
      );
      builder.addEmail(
        firstRecordValue(record, ['email', 'contactEmail']),
        pageUrl,
        'embedded-json',
      );
      const address = firstRecordValue(record, [
        'formattedAddress',
        'fullAddress',
        'address',
      ]);
      if (typeof address === 'string') {
        builder.setLocation('formattedAddress', address, pageUrl, 'embedded-json', 70);
      }
      builder.setLocation(
        'mapUrl',
        firstRecordValue(record, ['mapUrl', 'mapsUrl']),
        pageUrl,
        'embedded-json',
        70,
      );
      builder.setMedia(
        'logoUrl',
        firstRecordValue(record, ['logoUrl', 'logo']),
        pageUrl,
        'embedded-json',
        70,
      );
      builder.setMedia(
        'coverImageUrl',
        firstRecordValue(record, ['coverImageUrl', 'coverImage', 'heroImage']),
        pageUrl,
        'embedded-json',
        70,
      );
      for (const image of asArray(
        firstRecordValue(record, ['galleryImageUrls', 'gallery', 'images']),
      )) {
        builder.addImage(
          asRecord(image)?.url ?? asRecord(image)?.src ?? image,
          pageUrl,
          'embedded-json',
        );
      }
    }

    for (const key of ['services', 'treatments', 'offerings', 'items']) {
      if (!Array.isArray(record[key])) continue;
      for (const rawService of record[key] as unknown[]) {
        const service = asRecord(rawService);
        if (!service) continue;
        const parsed = serviceFromRecord(service, pageUrl, 'embedded-json');
        if (parsed) builder.addService(parsed);
      }
    }
    for (const key of ['staff', 'employees', 'team', 'providers']) {
      if (!Array.isArray(record[key])) continue;
      for (const rawStaff of record[key] as unknown[]) {
        const member = staffFromRecord(
          asRecord(rawStaff) ?? { name: rawStaff },
          pageUrl,
          'embedded-json',
        );
        if (member) builder.addStaff(member);
      }
    }
    for (const rawHours of asArray(
      firstRecordValue(record, ['openingHours', 'businessHours', 'workingHours']),
    )) {
      const hourRecord = asRecord(rawHours);
      if (hourRecord) {
        const days = asArray(firstRecordValue(hourRecord, ['dayOfWeek', 'days', 'day']))
          .map(dayName)
          .filter((day): day is (typeof DAY_NAMES)[number] => Boolean(day));
        const opens = cleanText(firstRecordValue(hourRecord, ['opens', 'start', 'from']));
        const closes = cleanText(firstRecordValue(hourRecord, ['closes', 'end', 'to']));
        builder.addHours(
          {
            dayOfWeek: days,
            opens,
            closes,
            raw: `${days.join(', ')} ${opens ?? ''}-${closes ?? ''}`.trim(),
            sourceUrl: pageUrl,
          },
          'embedded-json',
        );
      } else {
        builder.addHours(parseHoursText(rawHours, pageUrl), 'embedded-json');
      }
    }

    const policy = asRecord(
      firstRecordValue(record, ['bookingPolicy', 'policies', 'bookingSettings']),
    );
    if (policy) {
      const minLead = Number(
        firstRecordValue(policy, ['minLeadTimeMinutes', 'minimumLeadMinutes']),
      );
      const cancellation = Number(
        firstRecordValue(policy, ['cancellationWindowHours', 'minimumCancellationHours']),
      );
      const advance = Number(
        firstRecordValue(policy, ['maxAdvanceBookingDays', 'advanceBookingDays']),
      );
      const approval = firstRecordValue(policy, [
        'bookingRequiresApproval',
        'requiresApproval',
      ]);
      if (Number.isFinite(minLead) && minLead >= 0) {
        builder.setPolicy(
          'minLeadTimeMinutes',
          minLead,
          pageUrl,
          'embedded-json',
          90,
          JSON.stringify(policy),
        );
      }
      if (Number.isFinite(cancellation) && cancellation >= 0) {
        builder.setPolicy(
          'cancellationWindowHours',
          cancellation,
          pageUrl,
          'embedded-json',
          90,
          JSON.stringify(policy),
        );
      }
      if (Number.isFinite(advance) && advance > 0) {
        builder.setPolicy(
          'maxAdvanceBookingDays',
          advance,
          pageUrl,
          'embedded-json',
          90,
          JSON.stringify(policy),
        );
      }
      if (typeof approval === 'boolean') {
        builder.setPolicy(
          'bookingRequiresApproval',
          approval,
          pageUrl,
          'embedded-json',
          90,
          JSON.stringify(policy),
        );
      }
    }

    for (const [key, child] of Object.entries(record)) {
      if (child && typeof child === 'object') visit(child, `${path}.${key}`);
    }
  };

  $('script[type="application/json"],script#__NEXT_DATA__').each((_index, element) => {
    const raw = $(element).html()?.trim();
    if (!raw || raw.length > 1_500_000 || !/^[{\[]/.test(raw)) return;
    try {
      visit(JSON.parse(raw), 'root');
    } catch {
      // Third-party pages often include non-JSON script payloads. JSON-LD warnings
      // remain separate because those blocks explicitly promise valid JSON.
    }
  });
}

function extractDom(
  builder: DraftBuilder,
  $: CheerioAPI,
  pageUrl: string,
  sourceType: BusinessImportSourceType,
): void {
  for (const selector of ['[itemprop="telephone"]', 'a[href^="tel:"]']) {
    $(selector).each((_index, element) => {
      builder.addPhone(
        $(element).attr('content') ?? $(element).attr('href') ?? $(element).text(),
        pageUrl,
        'html-attribute',
      );
    });
  }
  for (const selector of ['[itemprop="email"]', 'a[href^="mailto:"]']) {
    $(selector).each((_index, element) => {
      builder.addEmail(
        $(element).attr('content') ?? $(element).attr('href') ?? $(element).text(),
        pageUrl,
        'html-attribute',
      );
    });
  }

  const body = $('body').clone();
  body.find('script,style,noscript,svg').remove();
  const visibleText = cleanText(body.text()) ?? '';
  extractContactsFromText(builder, visibleText, pageUrl, 'visible-text');
  $('p,li,[class*="policy"],[class*="terms"]').each((_index, element) => {
    extractPolicyText(builder, $(element).text(), pageUrl);
  });

  const itemAddress = $('[itemprop="address"]').first();
  const addressElement = itemAddress.length ? itemAddress : $('address').first();
  builder.setLocation(
    'formattedAddress',
    addressElement.attr('content') ?? addressElement.text(),
    pageUrl,
    'visible-text',
    60,
  );
  $('a[href*="google.com/maps"],a[href*="maps.app.goo.gl"],a[href*="waze.com"]').each(
    (_index, element) => {
      const href = normalizeUrl($(element).attr('href'), pageUrl);
      if (!href) return;
      builder.setLocation('mapUrl', href, pageUrl, 'link', 90);
      const parsed = new URL(href);
      const address =
        parsed.searchParams.get('query') ??
        parsed.searchParams.get('q') ??
        parsed.searchParams.get('destination');
      builder.setLocation('formattedAddress', address, pageUrl, 'link', 80);
    },
  );
  for (const [field, itemprop] of [
    ['streetAddress', 'streetAddress'],
    ['locality', 'addressLocality'],
    ['region', 'addressRegion'],
    ['postalCode', 'postalCode'],
    ['country', 'addressCountry'],
  ] as const) {
    const element = $(`[itemprop="${itemprop}"]`).first();
    builder.setLocation(
      field,
      element.attr('content') ?? element.text(),
      pageUrl,
      'html-attribute',
      70,
    );
  }

  for (const selector of [
    '[itemprop="openingHours"]',
    'time[class*="hours"]',
    '[class*="opening-hours"]',
    '[class*="business-hours"]',
  ]) {
    $(selector).each((_index, element) => {
      builder.addHours(
        parseHoursText($(element).attr('content') ?? $(element).text(), pageUrl),
        'visible-text',
      );
    });
  }
  $('p,li,span,div').each((_index, element) => {
    if ($(element).children().length > 0) return;
    const text = cleanText($(element).text());
    if (!text || text.length > 220 || !/\d{1,2}:\d{2}/.test(text)) return;
    builder.addHours(parseHoursText(text, pageUrl), 'visible-text');
  });

  const sourceProfile =
    sourceType === 'instagram'
      ? new URL(pageUrl).pathname.split('/').filter(Boolean)[0]
      : undefined;
  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    builder.addSocial(href, pageUrl, 'link', sourceProfile);
    if (sourceType === 'instagram') {
      const post = normalizeUrl(href, pageUrl);
      if (post) builder.addInstagramPost(post, pageUrl, 'link', sourceProfile);
    }
    const video = normalizeUrl(href, pageUrl);
    if (video && (sourceType === 'generic-site' || sourceType === 'calmark')) {
      builder.addVideo(video, pageUrl, 'link');
    }
  });

  const logoElement = $(
    'img[itemprop="logo"], img[class*="logo"], img[id*="logo"], header img[alt*="logo" i]',
  ).first();
  builder.setMedia(
    'logoUrl',
    logoElement.attr('data-dm-image-path') ??
      logoElement.attr('src') ??
      logoElement.attr('data-src') ??
      srcsetUrl(logoElement.attr('srcset'), pageUrl),
    pageUrl,
    'html-attribute',
    70,
  );
  const businessName = builder.draft.business.name;
  if (businessName) {
    $('img[alt]').each((_index, element) => {
      if (uniqueKey($(element).attr('alt') ?? '') !== uniqueKey(businessName)) return;
      builder.setMedia(
        'logoUrl',
        $(element).attr('data-dm-image-path') ??
          $(element).attr('src') ??
          $(element).attr('data-src') ??
          srcsetUrl($(element).attr('srcset'), pageUrl),
        pageUrl,
        'html-attribute',
        65,
      );
    });
  }

  $('img').each((_index, element) => {
    const image = $(element);
    const width = Number(image.attr('width'));
    const height = Number(image.attr('height'));
    const url = imageUrl(
      image.attr('data-dm-image-path') ??
        srcsetUrl(image.attr('srcset'), pageUrl) ??
        image.attr('src') ??
        image.attr('data-src'),
      pageUrl,
      {
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
      },
    );
    if (
      sourceType === 'instagram' &&
      url &&
      !/(?:cdninstagram|fbcdn)\./i.test(new URL(url).hostname)
    ) {
      return;
    }
    builder.addImage(url, pageUrl, 'html-attribute');
    const identity = `${image.attr('class') ?? ''} ${image.attr('id') ?? ''} ${image.attr('alt') ?? ''}`;
    if (/hero|cover|banner/i.test(identity)) {
      builder.setMedia('coverImageUrl', url, pageUrl, 'html-attribute', 70);
    }
    if (url && (looksLikeLogoUrl(url) || /logo|לוגו/i.test(identity))) {
      builder.setMedia('logoUrl', url, pageUrl, 'html-attribute', 95);
    } else if (
      url &&
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width * height >= 300_000
    ) {
      builder.setMedia(
        'coverImageUrl',
        url,
        pageUrl,
        'html-attribute',
        width * height >= 1_000_000 ? 60 : 55,
      );
    }
  });
  $('source[srcset]').each((_index, element) => {
    builder.addImage(
      srcsetUrl($(element).attr('srcset'), pageUrl),
      pageUrl,
      'html-attribute',
    );
  });
  $('video[src], video source[src]').each((_index, element) => {
    builder.addVideo($(element).attr('src'), pageUrl, 'html-attribute');
  });
  $('video[poster]').each((_index, element) => {
    builder.addImage($(element).attr('poster'), pageUrl, 'html-attribute');
  });
  $('script').each((_index, element) => {
    const script = $(element).html() ?? '';
    for (const match of script.matchAll(
      /(?:https?:\/\/|\/)[^"'\\\s<>]+?\.(?:mp4|webm)(?:\?[^"'\\\s<>]*)?(?=["'\\\s<>]|$)/gi,
    )) {
      builder.addVideo(match[0], pageUrl, 'embedded-json');
    }
  });

  $(
    '[itemprop="employee"],[class*="team-member"],[class*="staff-card"],[data-staff]',
  ).each((_index, element) => {
    const card = $(element);
    const name = cleanText(
      card.find('[itemprop="name"],h2,h3,h4,[class*="name"]').first().text(),
    );
    if (!name) return;
    const title = cleanText(
      card.find('[itemprop="jobTitle"],[class*="title"],[class*="role"]').first().text(),
    );
    const bio = cleanText(
      card.find('[itemprop="description"],p,[class*="bio"]').first().text(),
    );
    const imageElement = card.find('img').first();
    const image = imageUrl(
      imageElement.attr('data-dm-image-path') ??
        imageElement.attr('src') ??
        imageElement.attr('data-src'),
      pageUrl,
    );
    const member = staffFromRecord({ name, title, bio, image }, pageUrl, 'visible-text');
    if (member) builder.addStaff(member);
  });

  const serviceSelectors = [
    '[itemtype*="schema.org/Service"]',
    '[itemtype*="schema.org/Product"]',
    '[class~="service"]',
    '[class*="service-card"]',
    '[class*="service-item"]',
    '[class*="treatment-card"]',
    '[class*="treatment-item"]',
    '[class*="product-card"]',
    '[data-service]',
    'a[href*="service="]',
  ];
  $(serviceSelectors.join(',')).each((_index, element) => {
    const card = $(element);
    const text = cleanText(card.text());
    if (!text || text.length > 1_200) return;
    const name = cleanText(
      card
        .find('[itemprop="name"],h2,h3,h4,[class*="title"],[class*="name"]')
        .first()
        .text(),
    );
    if (!name || name.length > 160) return;
    const description = cleanText(
      card.find('[itemprop="description"],p,[class*="description"]').first().text(),
    );
    const standalonePrice = card
      .find('span,[data-price]')
      .toArray()
      .map((candidate) => cleanText($(candidate).text()))
      .find(
        (candidate) =>
          candidate !== null &&
          /^(?:(?:מחיר|price)\s*:?\s*)?(?:(?:₪|\$|€|ILS|NIS|USD|EUR)\s*)?\d[\d,.]*(?:\s*(?:₪|\$|€|ILS|NIS|USD|EUR))?$/i.test(
            candidate,
          ) &&
          /₪|\$|€|\b(?:ILS|NIS|USD|EUR)\b/i.test(candidate),
      );
    const priceText =
      cleanText(card.find('[itemprop="price"],[class*="price"]').first().text()) ??
      standalonePrice ??
      cleanText(text.match(/(?:₪|\b(?:ILS|NIS|USD|EUR)\b|\$|€)\s*\d[\d.,]*/i)?.[0]) ??
      cleanText(text.match(/\d[\d.,]*\s*(?:₪|\b(?:ILS|NIS|USD|EUR)\b|\$|€)/i)?.[0]);
    const currencyValue = card.find('[itemprop="priceCurrency"]').first().attr('content');
    const { price, currency } = parsePrice(priceText, currencyValue);
    const durationMinutes = parseDurationMinutes(text);
    const image = imageUrl(
      card.find('img').first().attr('src') ?? card.find('img').first().attr('data-src'),
      pageUrl,
    );
    const sourceUrl =
      normalizeUrl(card.find('a[href]').first().attr('href'), pageUrl) ?? pageUrl;
    const evidence: BusinessImportEvidence[] = [
      serviceEvidence(name, 'name', name, pageUrl, 'visible-text'),
    ];
    if (description) {
      evidence.push(
        serviceEvidence(name, 'description', description, pageUrl, 'visible-text'),
      );
    }
    if (price !== null) {
      evidence.push(serviceEvidence(name, 'price', price, pageUrl, 'visible-text'));
    }
    if (currency) {
      evidence.push(serviceEvidence(name, 'currency', currency, pageUrl, 'visible-text'));
    }
    if (durationMinutes !== null) {
      evidence.push(
        serviceEvidence(
          name,
          'durationMinutes',
          durationMinutes,
          pageUrl,
          'visible-text',
        ),
      );
    }
    if (image) {
      evidence.push(serviceEvidence(name, 'imageUrl', image, pageUrl, 'html-attribute'));
    }
    builder.addService({
      name,
      description,
      price,
      currency,
      durationMinutes,
      imageUrl: image,
      sourceUrl,
      evidence,
    });
  });
  extractSemanticServices(builder, $, pageUrl);
}

export function discoverRelevantLinks(html: string, pageUrl: string): string[] {
  const $ = load(html);
  const source = new URL(pageUrl);
  const candidates = new Map<string, number>();
  $('a[href]').each((_index, element) => {
    const href = normalizeUrl($(element).attr('href'), pageUrl);
    if (!href) return;
    const url = new URL(href);
    if (
      url.origin !== source.origin ||
      url.href === source.href ||
      url.search ||
      /\/(?:book|booking|checkout|cart|login|account|admin)(?:\/|$)/i.test(url.pathname)
    ) {
      return;
    }
    const haystack =
      `${url.pathname} ${cleanText($(element).text()) ?? ''}`.toLowerCase();
    const score = RELEVANT_LINK_TERMS.reduce(
      (sum, term) => sum + (haystack.includes(term.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > 0)
      candidates.set(url.href, Math.max(candidates.get(url.href) ?? 0, score));
  });
  return [...candidates.entries()]
    .sort(([urlA, scoreA], [urlB, scoreB]) => scoreB - scoreA || urlA.localeCompare(urlB))
    .map(([url]) => url);
}

export function looksPlatformBlocked(html: string): boolean {
  const text = html.toLowerCase();
  return (
    /login\s*[•|]\s*instagram|log in to instagram|accounts\/login|challenge_required/.test(
      text,
    ) || /log into facebook|you must log in|checkpoint\/|unsupported browser/.test(text)
  );
}

export function extractBusinessDraft(
  pages: ImportedHtmlPage[],
  sourceType: BusinessImportSourceType,
  sourceUrl: string,
): BusinessImportDraft {
  const builder = new DraftBuilder(
    sourceType,
    sourceUrl,
    pages.map((page) => page.finalUrl),
  );

  for (const page of pages) {
    const $ = load(page.html);
    const nodes: JsonRecord[] = [];
    $('script[type="application/ld+json"]').each((_index, element) => {
      const raw = $(element).html()?.trim();
      if (!raw) return;
      try {
        collectJsonLdNodes(JSON.parse(raw), nodes);
      } catch {
        builder.addWarning({
          code: 'invalid-json-ld',
          message: 'A JSON-LD block could not be parsed and was ignored.',
          sourceUrl: page.finalUrl,
        });
      }
    });
    extractBusinessJsonLd(builder, nodes, page.finalUrl);
    if (sourceType === 'generic-site' || sourceType === 'calmark') {
      extractEmbeddedJson(builder, $, page.finalUrl);
    }
    extractMetadata(builder, $, page.finalUrl, sourceType);
    extractDom(builder, $, page.finalUrl, sourceType);

    if (sourceType === 'generic-site' || sourceType === 'calmark') {
      builder.setBusiness('websiteUrl', page.finalUrl, page.finalUrl, 'canonical', 50);
    } else {
      builder.addSocial(page.finalUrl, page.finalUrl, 'canonical');
    }
  }

  const suggestionText = [
    builder.draft.business.name,
    builder.draft.business.industry,
    builder.draft.business.category,
    builder.draft.business.description,
  ]
    .filter(Boolean)
    .join(' ');
  const suggestion = sourceTypeSuggestion(suggestionText);
  if (suggestion) {
    builder.setBusiness(
      'typeSuggestion',
      suggestion,
      pages[0]?.finalUrl ?? sourceUrl,
      'heuristic',
      20,
      'Deterministic keyword mapping to the existing BusinessType values.',
    );
  }

  if (!builder.draft.business.name) {
    builder.addWarning({
      code: 'missing-name',
      message: 'No public business name was found.',
    });
  }
  if (
    builder.draft.contacts.phones.length === 0 &&
    builder.draft.contacts.emails.length === 0
  ) {
    builder.addWarning({
      code: 'missing-contact',
      message: 'No public phone number or email address was found.',
    });
  }
  if (!builder.draft.location.formattedAddress) {
    builder.addWarning({
      code: 'missing-address',
      message: 'No public physical address was found.',
    });
  }
  if (builder.draft.hours.length === 0) {
    builder.addWarning({
      code: 'missing-hours',
      message: 'No public opening hours were found.',
    });
  }
  if (builder.draft.services.length === 0) {
    builder.addWarning({
      code: 'missing-services',
      message: 'No public services or products were found.',
    });
  }
  if (builder.draft.staff.length === 0) {
    builder.addWarning({
      code: 'missing-staff',
      message: 'No public staff profiles were found.',
    });
  }
  if (
    builder.draft.bookingPolicy.minLeadTimeMinutes === null &&
    builder.draft.bookingPolicy.cancellationWindowHours === null &&
    builder.draft.bookingPolicy.maxAdvanceBookingDays === null &&
    builder.draft.bookingPolicy.bookingRequiresApproval === null &&
    builder.draft.bookingPolicy.notes.length === 0
  ) {
    builder.addWarning({
      code: 'missing-policy',
      message: 'No public booking policy was found.',
    });
  }
  if (
    !builder.draft.media.logoUrl &&
    !builder.draft.media.coverImageUrl &&
    builder.draft.media.galleryImageUrls.length === 0 &&
    builder.draft.media.videoUrls.length === 0
  ) {
    builder.addWarning({
      code: 'missing-media',
      message: 'No public logo, images, or videos were found.',
    });
  }

  return builder.draft;
}
