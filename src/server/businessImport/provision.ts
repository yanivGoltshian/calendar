import { Prisma, type BusinessType } from '@prisma/client';
import {
  BusinessCreationLimitError,
  BusinessIdentityConflictError,
  createBusiness,
} from '@/server/repos/business';
import {
  createService,
  deleteService,
  listServices,
  setServiceStaff,
  type ServiceInput,
} from '@/server/repos/services';
import { listStaff } from '@/server/repos/staff';
import { updateBusinessProfile } from '@/server/repos/settings';
import { setBusinessHours } from '@/server/repos/workingHours';
import {
  completeBusinessImport,
  getBusinessImportState,
} from '@/server/repos/businessImport';
import { importBusinessFromUrl } from './index';
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

type CreatedBusiness = Awaited<ReturnType<typeof createBusiness>>;
type CreateServiceWithStaff = (
  businessId: string,
  data: ServiceInput,
  staffIds?: string[],
) => ReturnType<typeof createService>;

export interface ProvisionBusinessDependencies {
  importer?: typeof importBusinessFromUrl;
  create?: typeof createBusiness;
  getImportState?: typeof getBusinessImportState;
  completeImport?: typeof completeBusinessImport;
  updateProfile?: typeof updateBusinessProfile;
  setHours?: typeof setBusinessHours;
  listExistingServices?: typeof listServices;
  removeService?: typeof deleteService;
  createImportedService?: CreateServiceWithStaff;
  assignServiceStaff?: typeof setServiceStaff;
  listActiveStaff?: typeof listStaff;
  importMedia?: typeof importBusinessMedia;
}

export class BusinessImportConflictError extends Error {
  constructor() {
    super('The provisioned business was already imported from a different source.');
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

async function replaceImportedServices(
  businessId: string,
  mapped: MappedBusinessImport,
  dependencies: ProvisionBusinessDependencies,
): Promise<void> {
  const listExisting = dependencies.listExistingServices ?? listServices;
  const remove = dependencies.removeService ?? deleteService;
  const create =
    dependencies.createImportedService ?? (createService as CreateServiceWithStaff);
  const assign = dependencies.assignServiceStaff ?? setServiceStaff;
  const activeStaff = await (dependencies.listActiveStaff ?? listStaff)(businessId);
  const staffIds = activeStaff.map(({ id }) => id);
  if (staffIds.length === 0) throw new Error('BUSINESS_IMPORT_ACTIVE_STAFF_REQUIRED');

  for (const service of await listExisting(businessId)) {
    const result = await remove(businessId, service.id);
    if (!result.ok)
      throw new Error(`BUSINESS_IMPORT_SERVICE_${result.reason.toUpperCase()}`);
  }
  for (const service of mapped.services) {
    const created = await create(businessId, service, staffIds);
    if (!(await assign(businessId, created.id, staffIds))) {
      throw new Error('BUSINESS_IMPORT_SERVICE_ASSIGNMENT_FAILED');
    }
  }
}

async function applyImportedDraft(
  business: CreatedBusiness,
  draft: BusinessImportDraft,
  mapped: MappedBusinessImport,
  dependencies: ProvisionBusinessDependencies,
): Promise<BusinessImportReviewSnapshot> {
  const getState = dependencies.getImportState ?? getBusinessImportState;
  const current = await getState(business.id);
  if (current?.businessImportedAt) {
    if (current.businessImportSourceUrl !== draft.sourceUrl) {
      throw new BusinessImportConflictError();
    }
    const stored = parseStoredSnapshot(current.businessImportDraft);
    if (stored) return stored;
  }

  const media: ImportedOwnedMedia = await (
    dependencies.importMedia ?? importBusinessMedia
  )(business.id, business.ownerEmail, mapped.media);
  const galleryImageUrls = media.galleryImageUrls;
  await (dependencies.updateProfile ?? updateBusinessProfile)(business.id, {
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
  });
  await (dependencies.setHours ?? setBusinessHours)(business.id, mapped.hours);
  await replaceImportedServices(business.id, mapped, dependencies);

  const snapshot: BusinessImportReviewSnapshot = {
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
  await (dependencies.completeImport ?? completeBusinessImport)(
    business.id,
    draft.sourceUrl,
    snapshot as unknown as Prisma.InputJsonValue,
  );
  return snapshot;
}

export async function provisionBusinessForAdmin(
  request: BusinessProvisionRequest,
  adminEmail: string,
  dependencies: ProvisionBusinessDependencies = {},
): Promise<{
  business: CreatedBusiness;
  importReview: BusinessImportReviewSnapshot | null;
}> {
  let draft: BusinessImportDraft | null = null;
  let mapped: MappedBusinessImport | null = null;
  if (request.importUrl) {
    draft = await (dependencies.importer ?? importBusinessFromUrl)(request.importUrl);
    mapped = mapBusinessImportDraft(draft, {
      name: request.name,
      type: request.type,
    });
  }

  const business = await (dependencies.create ?? createBusiness)({
    name: mapped?.name ?? request.name ?? '',
    type: mapped?.type ?? request.type,
    phone: mapped?.phone ?? null,
    address: mapped?.address ?? null,
    ownerEmail: request.ownerEmail,
    ownerName: request.ownerName,
    provisioning: {
      adminEmail,
      phoneIdentity: request.phoneIdentity,
    },
  });
  const importReview =
    draft && mapped
      ? await applyImportedDraft(business, draft, mapped, dependencies)
      : null;
  return { business, importReview };
}

export { BusinessCreationLimitError, BusinessIdentityConflictError };
