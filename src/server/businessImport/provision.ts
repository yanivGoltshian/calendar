import { randomUUID } from 'node:crypto';
import { Prisma, type BusinessType } from '@prisma/client';
import {
  BusinessCreationLimitError,
  BusinessIdentityConflictError,
  createBusiness,
  type CreatedBusiness,
} from '@/server/repos/business';
import {
  applyClaimedBusinessImport,
  claimBusinessImport,
  findExistingBusinessImports,
  getBusinessImportState,
  markBusinessImportFailed,
} from '@/server/repos/businessImport';
import { importBusinessFromUrl, parsePublicHttpUrl } from './index';
import { importBusinessMedia, type ImportedOwnedMedia } from './media';
import { mapBusinessImportDraft, type MappedBusinessImport } from './mapDraft';
import type { BusinessImportDraft, BusinessImportWarning } from './types';

export interface BusinessProvisionRequest {
  name: string | null;
  type: BusinessType | null;
  ownerName: string | null;
  ownerEmail: string;
  phoneIdentity: string | null;
  importUrl: string | null;
}

export interface BusinessImportReviewSnapshot {
  version: 1;
  draft: BusinessImportDraft;
  warnings: BusinessImportWarning[];
  missingFields?: string[];
  applied: {
    serviceCount: number;
    staffCount?: number;
    hoursCount: number;
    ownedMediaCount: number;
    bookingPolicyFieldCount?: number;
    mediaAssets?: ImportedOwnedMedia['assets'];
  };
}

export interface ProvisionBusinessDependencies {
  importer?: typeof importBusinessFromUrl;
  create?: typeof createBusiness;
  claimImport?: typeof claimBusinessImport;
  findExistingImports?: typeof findExistingBusinessImports;
  applyImport?: typeof applyClaimedBusinessImport;
  getImportState?: typeof getBusinessImportState;
  markImportFailed?: typeof markBusinessImportFailed;
  importMedia?: typeof importBusinessMedia;
}

export class BusinessImportConflictError extends Error {
  constructor() {
    super('The provisioned business cannot be modified by this import.');
  }
}

function parseStoredSnapshot(
  value: Prisma.JsonValue | null,
): BusinessImportReviewSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    !candidate.draft ||
    typeof candidate.draft !== 'object' ||
    Array.isArray(candidate.draft) ||
    !Array.isArray(candidate.warnings) ||
    !candidate.applied ||
    typeof candidate.applied !== 'object' ||
    Array.isArray(candidate.applied)
  ) {
    return null;
  }
  const draft = candidate.draft as unknown as BusinessImportDraft;
  const applied = candidate.applied as Record<string, unknown>;
  return {
    ...(candidate as unknown as BusinessImportReviewSnapshot),
    draft: {
      ...draft,
      location: { ...draft.location, mapUrl: draft.location?.mapUrl ?? null },
      staff: Array.isArray(draft.staff) ? draft.staff : [],
      bookingPolicy: draft.bookingPolicy ?? {
        minLeadTimeMinutes: null,
        cancellationWindowHours: null,
        maxAdvanceBookingDays: null,
        bookingRequiresApproval: null,
        notes: [],
      },
      media: {
        ...draft.media,
        instagramPostUrls: draft.media?.instagramPostUrls ?? [],
      },
    },
    missingFields: Array.isArray(candidate.missingFields)
      ? candidate.missingFields.filter(
          (field): field is string => typeof field === 'string',
        )
      : [],
    applied: {
      serviceCount: typeof applied.serviceCount === 'number' ? applied.serviceCount : 0,
      staffCount: typeof applied.staffCount === 'number' ? applied.staffCount : 0,
      hoursCount: typeof applied.hoursCount === 'number' ? applied.hoursCount : 0,
      ownedMediaCount:
        typeof applied.ownedMediaCount === 'number' ? applied.ownedMediaCount : 0,
      bookingPolicyFieldCount:
        typeof applied.bookingPolicyFieldCount === 'number'
          ? applied.bookingPolicyFieldCount
          : 0,
      mediaAssets: Array.isArray(applied.mediaAssets)
        ? (applied.mediaAssets as ImportedOwnedMedia['assets'])
        : [],
    },
  };
}

export function readBusinessImportReview(
  value: Prisma.JsonValue | null,
): BusinessImportReviewSnapshot | null {
  return parseStoredSnapshot(value);
}

async function waitForImportCompletion(
  businessId: string,
  sourceUrl: string,
  getState: typeof getBusinessImportState,
): Promise<BusinessImportReviewSnapshot> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const state = await getState(businessId);
    if (!state || state.businessImportSourceUrl !== sourceUrl) {
      throw new BusinessImportConflictError();
    }
    if (state.businessImportedAt) {
      const snapshot = parseStoredSnapshot(state.businessImportDraft);
      if (snapshot) return snapshot;
      throw new BusinessImportConflictError();
    }
    const marker = state.businessImportDraft;
    if (
      marker &&
      typeof marker === 'object' &&
      !Array.isArray(marker) &&
      (marker as Record<string, unknown>).status === 'failed'
    ) {
      throw new BusinessImportConflictError();
    }
  }
  throw new BusinessImportConflictError();
}

function buildSnapshot(
  draft: BusinessImportDraft,
  mapped: MappedBusinessImport,
  media: ImportedOwnedMedia,
): BusinessImportReviewSnapshot {
  const ownedMediaUrls = new Set(
    [
      media.logoUrl,
      media.coverImageUrl,
      ...media.galleryImageUrls,
      media.heroVideoUrl,
      ...Object.values(media.staffAvatarUrls ?? {}),
    ].filter((value): value is string => Boolean(value)),
  );
  const missingFields = [
    !draft.business.name && 'business.name',
    !draft.business.typeSuggestion && 'business.category',
    draft.contacts.phones.length === 0 && 'contacts.phone',
    draft.contacts.emails.length === 0 && 'contacts.email',
    !draft.location.formattedAddress && 'location.address',
    mapped.hours.length === 0 && 'hours',
    mapped.services.length === 0 && 'services',
    mapped.staff.length === 0 && 'staff',
    !media.logoUrl && 'media.logo',
    !media.coverImageUrl && 'media.hero',
    media.galleryImageUrls.length === 0 && 'media.gallery',
    draft.bookingPolicy.notes.length === 0 &&
      draft.bookingPolicy.minLeadTimeMinutes === null &&
      draft.bookingPolicy.cancellationWindowHours === null &&
      draft.bookingPolicy.maxAdvanceBookingDays === null &&
      draft.bookingPolicy.bookingRequiresApproval === null &&
      'bookingPolicy',
  ].filter((value): value is string => Boolean(value));
  return {
    version: 1,
    draft,
    warnings: [...mapped.warnings, ...media.warnings],
    missingFields,
    applied: {
      serviceCount: mapped.services.length,
      staffCount: mapped.staff.length,
      hoursCount: mapped.hours.length,
      ownedMediaCount: ownedMediaUrls.size,
      bookingPolicyFieldCount: Object.keys(mapped.bookingPolicy).length,
      mediaAssets: media.assets ?? [],
    },
  };
}

export async function provisionBusinessForAdmin(
  request: BusinessProvisionRequest,
  adminEmail: string,
  dependencies: ProvisionBusinessDependencies = {},
): Promise<{
  business: CreatedBusiness;
  importReview: BusinessImportReviewSnapshot | null;
}> {
  const create = dependencies.create ?? createBusiness;
  if (!request.importUrl) {
    const business = await create({
      name: request.name ?? '',
      type: request.type,
      phone: null,
      address: null,
      ownerEmail: request.ownerEmail,
      ownerName: request.ownerName,
      provisioning: {
        adminEmail,
        phoneIdentity: request.phoneIdentity,
      },
    });
    return { business, importReview: null };
  }

  const requestedSourceUrl = parsePublicHttpUrl(request.importUrl).href;
  const existing = await (
    dependencies.findExistingImports ?? findExistingBusinessImports
  )(request.ownerEmail, request.phoneIdentity);
  if (existing.length > 0) {
    if (
      existing.length !== 1 ||
      existing[0].businessImportSourceUrl !== requestedSourceUrl
    ) {
      throw new BusinessImportConflictError();
    }
    const business = existing[0];
    if (business.businessImportedAt) {
      const snapshot = parseStoredSnapshot(business.businessImportDraft);
      if (!snapshot) throw new BusinessImportConflictError();
      return { business, importReview: snapshot };
    }
    const marker = business.businessImportDraft;
    if (
      marker &&
      typeof marker === 'object' &&
      !Array.isArray(marker) &&
      (marker as Record<string, unknown>).status === 'importing'
    ) {
      const snapshot = await waitForImportCompletion(
        business.id,
        requestedSourceUrl,
        dependencies.getImportState ?? getBusinessImportState,
      );
      return { business, importReview: snapshot };
    }
    throw new BusinessImportConflictError();
  }

  const draft = await (dependencies.importer ?? importBusinessFromUrl)(request.importUrl);
  const mapped = mapBusinessImportDraft(draft, {
    name: request.name,
    type: request.type,
  });
  const business = await create({
    name: mapped.name,
    type: mapped.type,
    phone: mapped.phone,
    address: mapped.address,
    ownerEmail: request.ownerEmail,
    ownerName: request.ownerName,
    provisioning: {
      adminEmail,
      phoneIdentity: request.phoneIdentity,
      mustCreate: true,
    },
  });

  const claimToken = randomUUID();
  const claim = await (dependencies.claimImport ?? claimBusinessImport)({
    businessId: business.id,
    sourceUrl: requestedSourceUrl,
    claimToken,
    expectedUpdatedAt: business.updatedAt,
    childBaseline: business.importChildBaseline,
  });
  if (claim.status === 'completed') {
    const snapshot = parseStoredSnapshot(claim.draft);
    if (!snapshot) throw new BusinessImportConflictError();
    return { business, importReview: snapshot };
  }
  if (claim.status === 'pending') {
    const snapshot = await waitForImportCompletion(
      business.id,
      requestedSourceUrl,
      dependencies.getImportState ?? getBusinessImportState,
    );
    return { business, importReview: snapshot };
  }
  if (claim.status !== 'claimed') throw new BusinessImportConflictError();

  try {
    const media = await (dependencies.importMedia ?? importBusinessMedia)(
      business.id,
      business.ownerEmail,
      mapped.media,
    );
    const galleryImageUrls = media.galleryImageUrls;
    const heroImages = [media.coverImageUrl, ...galleryImageUrls]
      .filter((value): value is string => Boolean(value))
      .slice(0, 2);
    const landingContent = mapped.landingContent
      ? {
          ...mapped.landingContent,
          ...(heroImages.length ? { heroImages } : {}),
          ...(galleryImageUrls.length ? { galleryImageUrls } : {}),
          ...(media.heroVideoUrl ? { heroVideoUrl: media.heroVideoUrl } : {}),
          ...(media.coverImageUrl ? { heroPosterUrl: media.coverImageUrl } : {}),
        }
      : null;
    const snapshot = buildSnapshot(draft, mapped, media);
    const applied = await (dependencies.applyImport ?? applyClaimedBusinessImport)({
      businessId: business.id,
      sourceUrl: requestedSourceUrl,
      claimToken,
      claimedUpdatedAt: claim.claimedUpdatedAt,
      childBaseline: business.importChildBaseline,
      profile: {
        name: mapped.name,
        type: mapped.type,
        phone: mapped.phone,
        address: mapped.address,
        description: mapped.description,
        instagramUrl: mapped.instagramUrl,
        logoUrl: media.logoUrl,
        coverImageUrl: media.coverImageUrl,
        brandColor: business.brandColor,
        timezone: business.timezone,
        publicPageStyle: mapped.publicPageStyle,
        landingContent:
          landingContent === null
            ? null
            : (landingContent as unknown as Prisma.InputJsonValue),
      },
      hours: mapped.hours,
      services: mapped.services,
      staff: mapped.staff.map((member) => ({
        ...member,
        avatarUrl: media.staffAvatarUrls?.[member.key] ?? null,
      })),
      bookingPolicy: mapped.bookingPolicy,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    });
    if (applied.status !== 'completed') throw new BusinessImportConflictError();
    const stored = parseStoredSnapshot(applied.draft);
    if (!stored) throw new BusinessImportConflictError();
    return { business, importReview: stored };
  } catch (error) {
    await (dependencies.markImportFailed ?? markBusinessImportFailed)({
      businessId: business.id,
      sourceUrl: requestedSourceUrl,
      claimToken,
    });
    throw error;
  }
}

export { BusinessCreationLimitError, BusinessIdentityConflictError };
