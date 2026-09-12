import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { engagementTags, type ClientSegment, type EngagementSummary } from '@/lib/clientEngagement';

type EngagementRow = EngagementSummary & { clientId: string };

async function engagementRows(businessId: string, now: Date, clientIds?: string[]) {
  if (clientIds?.length === 0) return [];
  const recent = new Date(now.getTime() - 30 * 86_400_000);
  const quarter = new Date(now.getTime() - 90 * 86_400_000);
  return prisma.$queryRaw<EngagementRow[]>`
    SELECT "clientId", COUNT(*)::int AS "bookingCount",
      BOOL_OR("createdAt" >= ${recent} AND "createdAt" <= ${now}) AS "recentBooking",
      BOOL_OR(status IN ('ARRIVED', 'DONE') AND "startAt" <= ${now}) AS visited,
      BOOL_OR("createdAt" >= ${quarter} AND "createdAt" <= ${now}) AS "quarterBooking"
    FROM "Appointment"
    WHERE "businessId" = ${businessId} AND status <> 'CANCELLED'
      ${clientIds ? Prisma.sql`AND "clientId" IN (${Prisma.join(clientIds)})` : Prisma.empty}
    GROUP BY "clientId"`;
}

export async function clientSegmentWhere(
  businessId: string,
  segment: ClientSegment | 'blocked',
  now = new Date(),
): Promise<Prisma.ClientWhereInput> {
  if (segment === 'active') return { businessId, blocked: false };
  if (segment === 'blocked') return { businessId, blocked: true };
  if (segment === 'with_appointments') return { businessId, appointments: { some: {} } };
  if (segment === 'all') return { businessId };
  const rows = await engagementRows(businessId, now);
  return { businessId, id: { in: rows.filter(row => engagementTags(row).includes(segment)).map(row => row.clientId) } };
}

export async function clientEngagementTags(businessId: string, clientIds: string[], now = new Date()) {
  const rows = await engagementRows(businessId, now, clientIds);
  return new Map(rows.map(row => [row.clientId, engagementTags(row)]));
}
