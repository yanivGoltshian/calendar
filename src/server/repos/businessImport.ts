import { Prisma, type BusinessType } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  childBaselinesMatch,
  lockBusinessImportChildren,
  readBusinessImportChildBaseline,
  type BusinessImportChildBaseline,
} from '@/server/businessImport/baseline';

interface ImportClaimMarker {
  version: 1;
  status: 'importing' | 'failed';
  claimToken: string;
  recordedAt: string;
}

export type BusinessImportClaimResult =
  | { status: 'claimed'; claimedUpdatedAt: Date }
  | { status: 'completed'; draft: Prisma.JsonValue | null }
  | { status: 'pending' }
  | { status: 'existing' }
  | { status: 'modified' }
  | { status: 'conflict' };

export async function findExistingBusinessImports(
  ownerEmail: string,
  phoneIdentity: string | null,
) {
  return prisma.business.findMany({
    where: {
      OR: [
        { ownerEmail: { equals: ownerEmail, mode: 'insensitive' } },
        ...(phoneIdentity ? [{ ownerPhoneIdentity: phoneIdentity }] : []),
      ],
    },
    include: { settings: true },
  });
}

export interface ApplyBusinessImportInput {
  businessId: string;
  sourceUrl: string;
  claimToken: string;
  claimedUpdatedAt: Date;
  childBaseline: BusinessImportChildBaseline;
  profile: {
    name: string;
    type: BusinessType;
    phone: string | null;
    address: string | null;
    description: string | null;
    instagramUrl: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    brandColor: string | null;
    timezone: string;
    landingContent: Prisma.InputJsonValue | null;
  };
  hours: Array<{
    weekday: number;
    startMinute: number;
    endMinute: number;
    breaks: Array<[number, number]>;
  }>;
  services: Array<{
    name: string;
    description?: string;
    durationMin: number;
    priceAgorot: number;
    hidePrice: boolean;
    hideDuration: boolean;
    hidden: boolean;
  }>;
  snapshot: Prisma.InputJsonValue;
}

export type ApplyBusinessImportResult =
  | { status: 'completed'; draft: Prisma.JsonValue | null }
  | { status: 'modified' }
  | { status: 'pending' }
  | { status: 'conflict' }
  | { status: 'service_in_use' };

function parseClaimMarker(value: Prisma.JsonValue | null): ImportClaimMarker | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    (candidate.status !== 'importing' && candidate.status !== 'failed') ||
    typeof candidate.claimToken !== 'string' ||
    typeof candidate.recordedAt !== 'string'
  ) {
    return null;
  }
  return candidate as unknown as ImportClaimMarker;
}

export async function getBusinessImportState(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    select: {
      businessImportSourceUrl: true,
      businessImportDraft: true,
      businessImportedAt: true,
    },
  });
}

export async function claimBusinessImport(input: {
  businessId: string;
  sourceUrl: string;
  claimToken: string;
  expectedUpdatedAt: Date;
  childBaseline: BusinessImportChildBaseline;
}): Promise<BusinessImportClaimResult> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${input.businessId} FOR UPDATE`;
      const business = await tx.business.findUnique({
        where: { id: input.businessId },
        select: {
          updatedAt: true,
          businessImportSourceUrl: true,
          businessImportDraft: true,
          businessImportedAt: true,
        },
      });
      if (!business) return { status: 'conflict' };

      if (business.businessImportedAt) {
        return business.businessImportSourceUrl === input.sourceUrl
          ? { status: 'completed', draft: business.businessImportDraft }
          : { status: 'conflict' };
      }

      if (business.businessImportSourceUrl) {
        if (business.businessImportSourceUrl !== input.sourceUrl) {
          return { status: 'conflict' };
        }
        const marker = parseClaimMarker(business.businessImportDraft);
        return marker?.status === 'importing'
          ? { status: 'pending' }
          : { status: 'conflict' };
      }

      if (business.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
        return { status: 'modified' };
      }
      const childBaseline = await readBusinessImportChildBaseline(tx, input.businessId);
      if (!childBaselinesMatch(input.childBaseline, childBaseline)) {
        return { status: 'modified' };
      }

      const marker: ImportClaimMarker = {
        version: 1,
        status: 'importing',
        claimToken: input.claimToken,
        recordedAt: new Date().toISOString(),
      };
      const claimed = await tx.business.update({
        where: { id: input.businessId },
        data: {
          businessImportSourceUrl: input.sourceUrl,
          businessImportDraft: marker as unknown as Prisma.InputJsonValue,
        },
        select: { updatedAt: true },
      });
      return { status: 'claimed', claimedUpdatedAt: claimed.updatedAt };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

export async function markBusinessImportFailed(input: {
  businessId: string;
  sourceUrl: string;
  claimToken: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${input.businessId} FOR UPDATE`;
    const business = await tx.business.findUnique({
      where: { id: input.businessId },
      select: {
        businessImportSourceUrl: true,
        businessImportDraft: true,
        businessImportedAt: true,
      },
    });
    const marker = parseClaimMarker(business?.businessImportDraft ?? null);
    if (
      !business ||
      business.businessImportedAt ||
      business.businessImportSourceUrl !== input.sourceUrl ||
      marker?.claimToken !== input.claimToken
    ) {
      return;
    }
    await tx.business.update({
      where: { id: input.businessId },
      data: {
        businessImportDraft: {
          version: 1,
          status: 'failed',
          claimToken: input.claimToken,
          recordedAt: new Date().toISOString(),
        } satisfies ImportClaimMarker,
      },
    });
  });
}

export async function applyClaimedBusinessImport(
  input: ApplyBusinessImportInput,
): Promise<ApplyBusinessImportResult> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${input.businessId} FOR UPDATE`;
        const business = await tx.business.findUnique({
          where: { id: input.businessId },
          select: {
            updatedAt: true,
            businessImportSourceUrl: true,
            businessImportDraft: true,
            businessImportedAt: true,
          },
        });
        if (!business) return { status: 'conflict' };
        if (business.businessImportedAt) {
          return business.businessImportSourceUrl === input.sourceUrl
            ? { status: 'completed', draft: business.businessImportDraft }
            : { status: 'conflict' };
        }
        if (business.businessImportSourceUrl !== input.sourceUrl) {
          return { status: 'conflict' };
        }
        const marker = parseClaimMarker(business.businessImportDraft);
        if (marker?.status !== 'importing' || marker.claimToken !== input.claimToken) {
          return { status: 'pending' };
        }
        if (business.updatedAt.getTime() !== input.claimedUpdatedAt.getTime()) {
          return { status: 'modified' };
        }
        await lockBusinessImportChildren(tx, input.businessId);
        const childBaseline = await readBusinessImportChildBaseline(tx, input.businessId);
        if (!childBaselinesMatch(input.childBaseline, childBaseline)) {
          return { status: 'modified' };
        }

        const staff = await tx.staffMember.findMany({
          where: { businessId: input.businessId, active: true },
          select: { id: true },
        });
        if (staff.length === 0) return { status: 'modified' };

        const existingServiceIds = (
          await tx.service.findMany({
            where: { businessId: input.businessId },
            select: { id: true },
          })
        ).map(({ id }) => id);
        if (existingServiceIds.length > 0) {
          const [appointmentLinks, waitlistLinks, punchCardLinks, saleLinks] =
            await Promise.all([
              tx.appointmentService.count({
                where: { serviceId: { in: existingServiceIds } },
              }),
              tx.waitlistEntry.count({
                where: { serviceId: { in: existingServiceIds } },
              }),
              tx.punchCard.count({
                where: { serviceId: { in: existingServiceIds } },
              }),
              tx.saleItem.count({
                where: { serviceId: { in: existingServiceIds } },
              }),
            ]);
          if (appointmentLinks + waitlistLinks + punchCardLinks + saleLinks > 0) {
            return { status: 'service_in_use' };
          }
        }

        await tx.workingHours.deleteMany({
          where: { scope: 'BUSINESS', businessId: input.businessId },
        });
        if (input.hours.length > 0) {
          await tx.workingHours.createMany({
            data: input.hours.map((row) => ({
              ...row,
              scope: 'BUSINESS' as const,
              businessId: input.businessId,
            })),
          });
        }

        await tx.service.deleteMany({ where: { businessId: input.businessId } });
        for (const [sortOrder, service] of input.services.entries()) {
          // Mirrors the service repository contract: explicit active staff IDs are
          // validated above and their links are created atomically with the service.
          await tx.service.create({
            data: {
              businessId: input.businessId,
              sortOrder,
              ...service,
              staffLinks: {
                create: staff.map(({ id }) => ({ staffId: id })),
              },
            },
          });
        }

        await tx.business.update({
          where: { id: input.businessId },
          data: {
            name: input.profile.name,
            type: input.profile.type,
            phone: input.profile.phone,
            address: input.profile.address,
            description: input.profile.description,
            instagramUrl: input.profile.instagramUrl,
            logoUrl: input.profile.logoUrl,
            coverImageUrl: input.profile.coverImageUrl,
            brandColor: input.profile.brandColor,
            timezone: input.profile.timezone,
            landingContent:
              input.profile.landingContent === null
                ? Prisma.DbNull
                : input.profile.landingContent,
            businessImportDraft: input.snapshot,
            businessImportedAt: new Date(),
          },
        });
        return {
          status: 'completed',
          draft: input.snapshot as unknown as Prisma.JsonValue,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 20_000,
      },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return { status: 'modified' };
    }
    throw error;
  }
}
