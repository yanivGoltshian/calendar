import { prisma } from '../src/lib/db';
import { requireIsolatedDatabase, type bookingFixture } from './fixtures';

export async function seedEngagementClients(f: Awaited<ReturnType<typeof bookingFixture>>, now = new Date()) {
  requireIsolatedDatabase();
  const recent = await prisma.client.update({
    where: { id: f.client.id }, data: { name: 'Recent returning client', email: 'recent@example.invalid' },
  });
  const past = await prisma.client.create({
    data: { businessId: f.business.id, name: 'Past visitor', email: 'past@example.invalid' },
  });
  const cancelled = await prisma.client.create({
    data: { businessId: f.business.id, name: 'Cancelled bookings only', blocked: true },
  });
  const unvisited = await prisma.client.create({
    data: { businessId: f.business.id, name: 'Never visited client' },
  });
  let sequence = 0;
  for (const entry of [
    { client: recent, count: 3, age: 120, status: 'DONE' as const },
    { client: recent, count: 1, age: 5, status: 'CONFIRMED' as const },
    { client: past, count: 1, age: 120, status: 'DONE' as const },
    { client: cancelled, count: 4, age: 5, status: 'CANCELLED' as const },
    { client: unvisited, count: 1, age: 120, status: 'CONFIRMED' as const },
  ]) {
    for (let i = 0; i < entry.count; i++) {
      const startAt = entry.age > 90
        ? new Date(now.getTime() - 100 * 86_400_000 + sequence * 3_600_000)
        : new Date(f.startAt.getTime() + sequence * 3_600_000);
      await prisma.appointment.create({ data: {
        businessId: f.business.id, clientId: entry.client.id, staffId: f.staff.id,
        startAt, endAt: new Date(startAt.getTime() + 30 * 60_000),
        createdAt: new Date(now.getTime() - entry.age * 86_400_000),
        status: entry.status, totalPriceAgorot: 0,
      } });
      sequence++;
    }
  }
  return { recent, past, cancelled, unvisited };
}
