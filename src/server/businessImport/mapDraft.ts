import type { BusinessType } from '@prisma/client';
import type { LandingContent } from '@/lib/publicPageStyle';
import {
  isDirectVideoUrl,
  isSupportedSocialVideoUrl,
  normalizeInstagramPostUrl,
} from '@/lib/publicMediaUrl';
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
  videoUrls?: string[];
  staffImages?: Array<{ staffKey: string; url: string }>;
}

export interface ImportedStaffInput {
  key: string;
  name: string;
  title: string | null;
  bio: string | null;
  serviceNames: string[];
}

export interface ImportedBookingPolicyInput {
  minLeadTimeMinutes?: number;
  cancellationWindowHours?: number;
  maxAdvanceBookingDays?: number;
  bookingRequiresApproval?: boolean;
}

export interface MappedBusinessImport {
  name: string;
  type: BusinessType;
  phone: string | null;
  description: string | null;
  address: string | null;
  instagramUrl: string | null;
  publicPageStyle: 'BOOKING' | 'LANDING';
  landingContent: LandingContent | null;
  services: ImportedServiceInput[];
  staff: ImportedStaffInput[];
  hours: ImportedWorkingHoursInput[];
  bookingPolicy: ImportedBookingPolicyInput;
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

function staffKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
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
  const socialLinks = Object.fromEntries(
    draft.socialLinks
      .filter(({ platform }) =>
        ['instagram', 'facebook', 'whatsapp', 'tiktok'].includes(platform),
      )
      .map(({ platform, url }) => [platform, url]),
  );
  const staff = draft.staff.slice(0, 20).map((member) => ({
    key: staffKey(member.name),
    name: member.name.trim().slice(0, 120),
    title: cleanOptional(member.title, 120),
    bio: cleanOptional(member.bio, 1_000),
    serviceNames: member.serviceNames
      .map((serviceName) => serviceName.trim().slice(0, 120))
      .filter(Boolean),
  }));
  const hours = mapHours(draft);
  const directVideoUrls = draft.media.videoUrls.filter(isDirectVideoUrl);
  const instagramPostUrls = draft.media.instagramPostUrls
    .map((url) => normalizeInstagramPostUrl(url))
    .filter((url): url is string => Boolean(url));
  const instagramPostKeys = new Set(instagramPostUrls);
  const socialVideoUrls = draft.media.videoUrls.filter(
    (url) =>
      isSupportedSocialVideoUrl(url) &&
      !instagramPostKeys.has(normalizeInstagramPostUrl(url) ?? ''),
  );
  const rejectedMediaUrls = [
    ...draft.media.videoUrls.filter(
      (url) =>
        !directVideoUrls.includes(url) &&
        !socialVideoUrls.includes(url) &&
        !instagramPostKeys.has(normalizeInstagramPostUrl(url) ?? ''),
    ),
    ...draft.media.instagramPostUrls.filter((url) => !normalizeInstagramPostUrl(url)),
  ];
  const mappingWarnings = [
    ...draft.warnings,
    ...services.warnings,
    ...rejectedMediaUrls.map((sourceUrl): BusinessImportWarning => ({
      code: 'media-rejected',
      message: 'An unsupported public media URL was omitted from the imported page.',
      sourceUrl,
    })),
  ];
  if (
    staff.length > 0 &&
    services.services.length > 0 &&
    staff.every(({ serviceNames }) => serviceNames.length === 0)
  ) {
    mappingWarnings.push({
      code: 'staff-service-links-assumed',
      message:
        'Staff and services were found without explicit assignments. Services were linked to the primary imported staff member for review.',
      sourceUrl: draft.sourceUrl,
    });
  }
  const hasRichContent = Boolean(
    description ||
    galleryImageUrls.length ||
    directVideoUrls.length ||
    socialVideoUrls.length ||
    instagramPostUrls.length ||
    Object.keys(socialLinks).length ||
    draft.business.websiteUrl ||
    draft.contacts.emails.length ||
    draft.location.mapUrl ||
    services.services.length ||
    staff.length ||
    hours.length,
  );
  const landingContent: LandingContent | null = hasRichContent
    ? {
        imported: true,
        presentation: 'premium',
        showStaff: staff.length > 0,
        heroHeadline: name,
        ...(description ? { heroSubtext: description, about: description } : {}),
        ...(socialVideoUrls.length
          ? { socialVideoUrls: socialVideoUrls.slice(0, 6) }
          : {}),
        ...(instagramPostUrls.length
          ? { instagramPostUrls: instagramPostUrls.slice(0, 6) }
          : {}),
        ...(Object.keys(socialLinks).length ? { socialLinks } : {}),
        ...(draft.business.websiteUrl || draft.contacts.emails[0] || draft.location.mapUrl
          ? {
              contact: {
                ...(draft.contacts.emails[0] ? { email: draft.contacts.emails[0] } : {}),
                ...(draft.business.websiteUrl
                  ? { websiteUrl: draft.business.websiteUrl }
                  : {}),
                ...(draft.location.mapUrl ? { mapUrl: draft.location.mapUrl } : {}),
              },
            }
          : {}),
        sections: {
          highlights: false,
          services: services.services.length > 0,
          gallery: galleryImageUrls.length > 0,
          beforeAfter: false,
          testimonials: false,
          faq: false,
          about: Boolean(description),
          location: Boolean(
            draft.location.formattedAddress ||
            draft.contacts.phones.length ||
            hours.length ||
            draft.contacts.emails.length ||
            draft.business.websiteUrl ||
            draft.location.mapUrl,
          ),
          socialCta: Object.keys(socialLinks).length > 0,
        },
      }
    : null;

  return {
    name,
    type,
    phone: cleanOptional(manual.phone, 30) ?? draft.contacts.phones[0] ?? null,
    description,
    address: cleanOptional(draft.location.formattedAddress, 500),
    instagramUrl,
    publicPageStyle: landingContent ? 'LANDING' : 'BOOKING',
    landingContent,
    services: services.services,
    staff,
    hours,
    bookingPolicy: {
      ...(draft.bookingPolicy.minLeadTimeMinutes !== null
        ? { minLeadTimeMinutes: draft.bookingPolicy.minLeadTimeMinutes }
        : {}),
      ...(draft.bookingPolicy.cancellationWindowHours !== null
        ? { cancellationWindowHours: draft.bookingPolicy.cancellationWindowHours }
        : {}),
      ...(draft.bookingPolicy.maxAdvanceBookingDays !== null
        ? { maxAdvanceBookingDays: draft.bookingPolicy.maxAdvanceBookingDays }
        : {}),
      ...(draft.bookingPolicy.bookingRequiresApproval !== null
        ? { bookingRequiresApproval: draft.bookingPolicy.bookingRequiresApproval }
        : {}),
    },
    media: {
      logoUrl: draft.media.logoUrl,
      coverImageUrl: draft.media.coverImageUrl,
      galleryImageUrls,
      videoUrls: directVideoUrls.slice(0, 2),
      staffImages: draft.staff.flatMap((member) =>
        member.imageUrl
          ? [{ staffKey: staffKey(member.name), url: member.imageUrl }]
          : [],
      ),
    },
    warnings: mappingWarnings,
  };
}
