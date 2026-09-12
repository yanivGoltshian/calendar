import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

type BusinessImportBaselineClient = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | 'service' | 'workingHours' | 'staffMember' | 'serviceStaff'
>;

export interface BusinessImportChildBaseline {
  version: 1;
  digest: string;
  serviceCount: number;
  businessHoursCount: number;
  staffCount: number;
  staffLinkCount: number;
}

export async function lockBusinessImportChildren(
  db: BusinessImportBaselineClient,
  businessId: string,
): Promise<void> {
  await db.$queryRaw`
    SELECT "id" FROM "Service"
    WHERE "businessId" = ${businessId}
    ORDER BY "id"
    FOR UPDATE
  `;
  await db.$queryRaw`
    SELECT "id" FROM "WorkingHours"
    WHERE "businessId" = ${businessId} AND "scope" = 'BUSINESS'
    ORDER BY "id"
    FOR UPDATE
  `;
  await db.$queryRaw`
    SELECT "id" FROM "StaffMember"
    WHERE "businessId" = ${businessId}
    ORDER BY "id"
    FOR UPDATE
  `;
  await db.$queryRaw`
    SELECT links."id" FROM "ServiceStaff" AS links
    INNER JOIN "Service" AS services ON services."id" = links."serviceId"
    WHERE services."businessId" = ${businessId}
    ORDER BY links."id"
    FOR UPDATE OF links
  `;
}

function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export async function readBusinessImportChildBaseline(
  db: BusinessImportBaselineClient,
  businessId: string,
): Promise<BusinessImportChildBaseline> {
  const [services, businessHours, staff, staffLinks] = await Promise.all([
    db.service.findMany({
      where: { businessId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        durationMin: true,
        priceAgorot: true,
        hidePrice: true,
        hideDuration: true,
        hidden: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.workingHours.findMany({
      where: { businessId, scope: 'BUSINESS' },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
        breaks: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.staffMember.findMany({
      where: { businessId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        userId: true,
        displayName: true,
        title: true,
        bio: true,
        avatarUrl: true,
        permissionLevel: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.serviceStaff.findMany({
      where: { service: { businessId } },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        serviceId: true,
        staffId: true,
        createdAt: true,
      },
    }),
  ]);
  const digest = createHash('sha256')
    .update(canonicalJson({ services, businessHours, staff, staffLinks }))
    .digest('hex');
  return {
    version: 1,
    digest,
    serviceCount: services.length,
    businessHoursCount: businessHours.length,
    staffCount: staff.length,
    staffLinkCount: staffLinks.length,
  };
}

export function childBaselinesMatch(
  expected: BusinessImportChildBaseline,
  actual: BusinessImportChildBaseline,
): boolean {
  return (
    expected.version === actual.version &&
    expected.digest === actual.digest &&
    expected.serviceCount === actual.serviceCount &&
    expected.businessHoursCount === actual.businessHoursCount &&
    expected.staffCount === actual.staffCount &&
    expected.staffLinkCount === actual.staffLinkCount
  );
}
