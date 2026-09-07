import { createHmac } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { BookingError } from './policy';

export function bookingDigest(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is required for booking abuse controls');
  return createHmac('sha256', secret).update(value).digest('hex');
}

export async function reserveBookingQuota(
  db: Prisma.TransactionClient,
  input: {
    businessId: string;
    phone?: string;
    email?: string;
    userId?: string;
    source?: string;
  },
  now: Date,
) {
  await db.bookingQuota.deleteMany({ where: { expiresAt: { lte: now } } });
  const hour = Math.floor(now.getTime() / 3_600_000);
  const day = Math.floor(now.getTime() / 86_400_000);
  const dimensions: Array<[string, number]> = [
    [`business:${input.businessId}:${day}`, 200],
    [`source:${input.source ?? 'unknown'}:${hour}`, 20],
  ];
  if (input.phone) dimensions.push([`phone:${input.phone}:${day}`, 5]);
  if (input.email) dimensions.push([`email:${input.email.toLowerCase()}:${day}`, 5]);
  if (input.userId) dimensions.push([`user:${input.userId}:${day}`, 10]);
  for (const [dimension, limit] of dimensions.sort(([a], [b]) => a.localeCompare(b))) {
    const key = bookingDigest(dimension);
    const row = await db.bookingQuota.upsert({
      where: { key },
      create: { key, used: 1, expiresAt: new Date((day + 2) * 86_400_000) },
      update: { used: { increment: 1 } },
    });
    if (row.used > limit) {
      console.warn(
        JSON.stringify({
          event: 'booking_quota_denied',
          businessId: input.businessId,
          dimension: dimension.split(':')[0],
        }),
      );
      throw new BookingError('booking_quota_exceeded', 429);
    }
  }
}
