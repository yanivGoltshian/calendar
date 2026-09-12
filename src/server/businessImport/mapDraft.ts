import type { BusinessType } from '@prisma/client';
import type {
  BusinessImportDraft,
  BusinessImportWarning,
  TorChickBusinessType,
} from './types';

const DAY_TO_WEEKDAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface ImportedServiceInput {
  name: string;
  durationMin: number;
  priceAgorot: number;
  description?: string;
  hidden: boolean;
  hidePrice: boolean;
  hideDuration: boolean;
}

export interface ImportedWorkingHoursInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
  breaks: never[];
}

export interface ImportedMediaCandidates {
  logoUrl: string | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
}

export interface MappedBusinessImport {
  name: string;
  type: BusinessType;
  phone: string | null;
  description: string | null;
  address: string | null;
  instagramUrl: string | null;
  landingContent: {
    heroHeadline?: string;
    heroSubtext?: string;
    galleryImageUrls?: string[];
  } | null;
  services: ImportedServiceInput[];
  hours: ImportedWorkingHoursInput[];
  media: ImportedMediaCandidates;
  warnings: BusinessImportWarning[];
}

function cleanOptional(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function parseMinutes(value: string | null): number | null {
  if (!value || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function mapHours(draft: BusinessImportDraft): ImportedWorkingHoursInput[] {
  const byWeekday = new Map<number, ImportedWorkingHoursInput>();
  for (const period of draft.hours) {
    const startMinute = parseMinutes(period.opens);
    const endMinute = parseMinutes(period.closes);
    if (startMinute === null || endMinute === null || endMinute <= startMinute) continue;
    for (const day of period.dayOfWeek) {
      const weekday = DAY_TO_WEEKDAY[day.toLowerCase().replace(/^https?:.*\//, '')];
      if (weekday === undefined || byWeekday.has(weekday)) continue;
      byWeekday.set(weekday, { weekday, startMinute, endMinute, breaks: [] });
    }
  }
  return [...byWeekday.values()].sort((a, b) => a.weekday - b.weekday);
}

function mapServices(draft: BusinessImportDraft): {
  services: ImportedServiceInput[];
  warnings: BusinessImportWarning[];
} {
  const warnings: BusinessImportWarning[] = [];
  const services = draft.services.slice(0, 100).map((service) => {
    const durationMin =
      service.durationMinutes && service.durationMinutes > 0
        ? Math.min(24 * 60, Math.round(service.durationMinutes))
        : 30;
    const hasSupportedPrice =
      service.price !== null &&
      service.price >= 0 &&
      ['ILS', 'NIS', '₪'].includes(service.currency?.toUpperCase() ?? '');

    if (service.durationMinutes === null) {
      warnings.push({
        code: 'default-duration',
        message: `The service "${service.name}" did not include a duration. A hidden 30-minute scheduling duration was assigned for review.`,
        sourceUrl: service.sourceUrl,
      });
    }
    if (service.price !== null && !hasSupportedPrice) {
      warnings.push({
        code: 'unsupported-currency',
        message: `The service "${service.name}" did not include a supported ILS price. Its price was hidden for review.`,
        sourceUrl: service.sourceUrl,
      });
    }

    return {
      name: service.name.trim().slice(0, 120),
      durationMin,
      priceAgorot: hasSupportedPrice ? Math.round((service.price ?? 0) * 100) : 0,
      description: cleanOptional(service.description, 1_000) ?? undefined,
      hideDuration: service.durationMinutes === null,
      hidePrice: !hasSupportedPrice,
      hidden: false,
    };
  });
  return { services: services.filter(({ name }) => name.length > 0), warnings };
}

function dedupeUrls(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function mapBusinessImportDraft(
  draft: BusinessImportDraft,
  manual: { name?: string | null; type?: BusinessType | null; phone?: string | null },
): MappedBusinessImport {
  const name = cleanOptional(manual.name, 120) ?? cleanOptional(draft.business.name, 120);
  if (!name) {
    throw new Error('BUSINESS_IMPORT_NAME_REQUIRED');
  }
  const type =
    manual.type ??
    ((draft.business.typeSuggestion ?? 'OTHER') satisfies TorChickBusinessType);
  const description = cleanOptional(draft.business.description, 2_000);
  const services = mapServices(draft);
  const instagramUrl =
    draft.socialLinks.find(({ platform }) => platform === 'instagram')?.url ?? null;
  const galleryImageUrls = dedupeUrls([
    ...draft.media.galleryImageUrls,
    ...draft.services.map(({ imageUrl }) => imageUrl),
  ]).slice(0, 24);

  return {
    name,
    type,
    phone: cleanOptional(manual.phone, 30) ?? draft.contacts.phones[0] ?? null,
    description,
    address: cleanOptional(draft.location.formattedAddress, 500),
    instagramUrl,
    landingContent:
      description || galleryImageUrls.length > 0
        ? {
            heroHeadline: name,
            heroSubtext: description ?? undefined,
          }
        : null,
    services: services.services,
    hours: mapHours(draft),
    media: {
      logoUrl: draft.media.logoUrl,
      coverImageUrl: draft.media.coverImageUrl,
      galleryImageUrls,
    },
    warnings: [...draft.warnings, ...services.warnings],
  };
}
