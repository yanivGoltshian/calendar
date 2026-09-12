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
  applied: {
    serviceCount: number;
    hoursCount: number;
    ownedMediaCount: number;
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
  if (candidate.version !== 1 || !candidate.draft || !Array.isArray(candidate.warnings)) {
    return null;
  }
  return value as unknown as BusinessImportReviewSnapshot;
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
  return {
    version: 1,
    draft,
    warnings: [...mapped.warnings, ...media.warnings],
    applied: {
      serviceCount: mapped.services.length,
      hoursCount: mapped.hours.length,
      ownedMediaCount:
        Number(Boolean(media.logoUrl)) +
        Number(Boolean(media.coverImageUrl)) +
        media.galleryImageUrls.length,
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
        landingContent: mapped.landingContent
          ? { ...mapped.landingContent, galleryImageUrls }
          : galleryImageUrls.length > 0
            ? { galleryImageUrls }
            : null,
      },
      hours: mapped.hours,
      services: mapped.services,
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
