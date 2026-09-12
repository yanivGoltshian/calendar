import { load, type CheerioAPI } from 'cheerio';

import type { ImportedHtmlPage } from './network';
import type {
  BusinessImportDraft,
  BusinessImportEvidence,
  BusinessImportEvidenceMethod,
  BusinessImportHours,
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

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned || null;
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
  if (!raw || /^(?:data|blob|javascript):/i.test(raw)) return null;
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
  if (match.platform === 'whatsapp') {
    const digits = `${parsed.pathname}${parsed.searchParams.get('phone') ?? ''}`.replace(
      /\D/g,
      '',
    );
    return { platform: 'whatsapp', url: `https://wa.me/${digits}` };
  }
  return { platform: match.platform, url };
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
    /(?:^|[/_.-])(?:favicon|sprite|spacer|tracking|pixel|1x1)(?:[/_.-]|$)/i.test(
      new URL(url).pathname,
    )
  ) {
    return null;
  }
  return url;
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
  private readonly socialKeys = new Set<string>();
  private readonly serviceIndexes = new Map<string, number>();

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
      },
      hours: [],
      services: [],
      media: {
        logoUrl: null,
        coverImageUrl: null,
        galleryImageUrls: [],
        videoUrls: [],
      },
      socialLinks: [],
      evidence: [],
      warnings: [],
    };
  }

  addEvidence(evidence: BusinessImportEvidence): void {
    const key = [
      evidence.field,
      evidence.value,
      evidence.sourceUrl,
      evidence.method,
      evidence.detail ?? '',
    ].join('\u0000');
    if (this.evidenceKeys.has(key)) return;
    this.evidenceKeys.add(key);
    this.draft.evidence.push(evidence);
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
    value: string | TorChickBusinessType | null,
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
    if (!url || this.imageKeys.has(url)) return;
    this.imageKeys.add(url);
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
    if (!url || this.videoKeys.has(url)) return;
    this.videoKeys.add(url);
    this.draft.media.videoUrls.push(url);
    this.addEvidence({
      field: 'media.videoUrls',
      value: url,
      sourceUrl,
      method,
    });
  }

  addSocial(
    value: unknown,
    sourceUrl: string,
    method: BusinessImportEvidenceMethod,
  ): void {
    const link = socialLink(value, sourceUrl);
    if (!link) return;
    const key = `${link.platform}:${link.url}`;
    if (this.socialKeys.has(key)) return;
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
    const key = uniqueKey(service.name);
    const existingIndex = this.serviceIndexes.get(key);
    if (existingIndex === undefined) {
      this.serviceIndexes.set(key, this.draft.services.length);
      this.draft.services.push(service);
      for (const evidence of service.evidence) this.addEvidence(evidence);
      return;
    }
    const existing = this.draft.services[existingIndex]!;
    existing.description ??= service.description;
    existing.price ??= service.price;
    existing.currency ??= service.currency;
    existing.durationMinutes ??= service.durationMinutes;
    existing.imageUrl ??= service.imageUrl;
    for (const evidence of service.evidence) {
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

function serviceFromJsonLd(
  node: JsonRecord,
  pageUrl: string,
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
    serviceEvidence(name, 'name', name, pageUrl, 'json-ld'),
  ];
  if (description)
    evidence.push(serviceEvidence(name, 'description', description, pageUrl, 'json-ld'));
  if (price !== null)
    evidence.push(serviceEvidence(name, 'price', price, pageUrl, 'json-ld'));
  if (currency)
    evidence.push(serviceEvidence(name, 'currency', currency, pageUrl, 'json-ld'));
  if (durationMinutes !== null) {
    evidence.push(
      serviceEvidence(name, 'durationMinutes', durationMinutes, pageUrl, 'json-ld'),
    );
  }
  if (image) evidence.push(serviceEvidence(name, 'imageUrl', image, pageUrl, 'json-ld'));
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
    for (const link of asArray(businessNode.sameAs)) {
      builder.addSocial(link, pageUrl, 'json-ld');
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
      const service = serviceFromJsonLd(node, pageUrl);
      if (service) builder.addService(service);
    }
    if (hasJsonLdType(node, ['OfferCatalog'])) {
      for (const entry of asArray(node.itemListElement)) {
        const record = asRecord(entry);
        if (!record) continue;
        const service = serviceFromJsonLd(record, pageUrl);
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
  const description = firstMeta(
    meta,
    'og:description',
    'description',
    'twitter:description',
  );
  builder.setBusiness(
    'description',
    description,
    pageUrl,
    meta.has('og:description') ? 'open-graph' : 'meta',
    80,
  );
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
  builder.setMedia('coverImageUrl', ogImage, pageUrl, 'open-graph', 80);
  builder.addImage(ogImage, pageUrl, 'open-graph');
  builder.setMedia('logoUrl', firstMeta(meta, 'og:logo'), pageUrl, 'open-graph', 75);
  for (const video of [
    ...asArray(meta.get('og:video')),
    ...asArray(meta.get('og:video:url')),
  ]) {
    builder.addVideo(video, pageUrl, 'open-graph');
  }
}

function extractDom(builder: DraftBuilder, $: CheerioAPI, pageUrl: string): void {
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

  const itemAddress = $('[itemprop="address"]').first();
  const addressElement = itemAddress.length ? itemAddress : $('address').first();
  builder.setLocation(
    'formattedAddress',
    addressElement.attr('content') ?? addressElement.text(),
    pageUrl,
    'visible-text',
    60,
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

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    builder.addSocial(href, pageUrl, 'link');
    const video = normalizeUrl(href, pageUrl);
    if (
      video &&
      /(?:youtube\.com\/watch|youtu\.be\/|vimeo\.com\/|tiktok\.com\/.+\/video\/|instagram\.com\/reel\/)/i.test(
        video,
      )
    ) {
      builder.addVideo(video, pageUrl, 'link');
    }
  });

  const logoElement = $(
    'img[itemprop="logo"], img[class*="logo"], img[id*="logo"], header img[alt*="logo" i]',
  ).first();
  builder.setMedia(
    'logoUrl',
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
    const url =
      srcsetUrl(image.attr('srcset'), pageUrl) ??
      imageUrl(image.attr('src') ?? image.attr('data-src'), pageUrl, {
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
      });
    builder.addImage(url, pageUrl, 'html-attribute');
    const identity = `${image.attr('class') ?? ''} ${image.attr('id') ?? ''} ${image.attr('alt') ?? ''}`;
    if (/hero|cover|banner/i.test(identity)) {
      builder.setMedia('coverImageUrl', url, pageUrl, 'html-attribute', 70);
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
    extractMetadata(builder, $, page.finalUrl, sourceType);
    extractDom(builder, $, page.finalUrl);

    if (sourceType === 'generic-site' || sourceType === 'calmark') {
      builder.setBusiness('websiteUrl', page.finalUrl, page.finalUrl, 'canonical', 50);
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
