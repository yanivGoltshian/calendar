import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/db';
import {
  addDaysToDateString,
  todayDateString,
  localWallTimeToUtc,
} from '../src/lib/time';

export function requireIsolatedDatabase() {
  const value = process.env.TEST_DATABASE_URL;
  if (
    !value ||
    value !== process.env.DATABASE_URL ||
    !['localhost', '127.0.0.1', 'postgres'].includes(new URL(value).hostname) ||
    !new URL(value).pathname.startsWith('/torchick_test')
  ) {
    throw new Error(
      'Integration tests require an isolated torchick_test database and matching TEST_DATABASE_URL',
    );
  }
}

export async function bookingFixture() {
  requireIsolatedDatabase();
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: { email: `${suffix}@example.invalid`, name: 'Synthetic owner' },
  });
  const business = await prisma.business.create({
    data: {
      slug: `test-${suffix}`,
      name: 'Synthetic clinic',
      ownerId: user.id,
      ownerEmail: user.email,
      plan: 'premium',
      subscriptionStatus: 'active',
      paidUntil: new Date(Date.now() + 30 * 86_400_000),
      settings: {
        create: {
          minLeadTimeMinutes: 0,
          slotGranularityMinutes: 30,
          maxAdvanceBookingDays: 30,
          cancellationWindowHours: 0,
          notifyOnBooking: false,
        },
      },
      workingHours: {
        create: [0, 1, 2, 3, 4, 5].map((weekday) => ({
          scope: 'BUSINESS',
          weekday,
          startMinute: 9 * 60,
          endMinute: 18 * 60,
          breaks: [[12 * 60, 13 * 60]],
        })),
      },
    },
  });
  const staff = await prisma.staffMember.create({
    data: { businessId: business.id, userId: user.id, displayName: 'Synthetic staff' },
  });
  const service = await prisma.service.create({
    data: {
      businessId: business.id,
      name: 'Synthetic service',
      durationMin: 30,
      priceAgorot: 5000,
      staffLinks: { create: { staffId: staff.id } },
    },
  });
  const date = addDaysToDateString(todayDateString(business.timezone), 3);
  const [y, m, d] = date.split('-').map(Number);
  const startAt = localWallTimeToUtc(y, m, d, 9 * 60, business.timezone);
  // Select an open day independently of the wall-clock day of the runner.
  if (
    new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: business.timezone,
    }).format(startAt) === 'Sat'
  ) {
    startAt.setUTCDate(startAt.getUTCDate() + 1);
  }
  const client = await prisma.client.create({
    data: { businessId: business.id, name: 'Synthetic client' },
  });
  return {
    business,
    staff,
    service,
    client,
    startAt,
    input: {
      businessId: business.id,
      staffId: staff.id,
      clientId: client.id,
      startAt,
      endAt: new Date(startAt.getTime() + 30 * 60_000),
      services: [service],
      totalPriceAgorot: service.priceAgorot,
    },
  };
}

export async function cleanupFixture(
  fixture: Awaited<ReturnType<typeof bookingFixture>>,
) {
  await prisma.appointment.deleteMany({ where: { businessId: fixture.business.id } });
  await prisma.business.delete({ where: { id: fixture.business.id } });
  await prisma.user.delete({ where: { id: fixture.staff.userId } });
}
