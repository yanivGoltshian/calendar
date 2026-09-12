import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { BookingError } from './policy';

export function isRetryableBookingTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (
    error.code === 'P2034' || error.code === 'P2002' ||
    // PostgreSQL serialization errors from explicit row locks use Prisma's raw-query code.
    (error.code === 'P2010' && error.meta?.code === '40001')
  );
}

export async function bookingTransaction<T>(
  work: (db: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 15_000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (isRetryableBookingTransactionError(error) && attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
          continue;
        }
        if (
          error.code === 'P2004' &&
          String(error.meta?.database_error).includes('Appointment_no_overlap')
        ) {
          throw new BookingError('slot_taken', 409);
        }
      }
      throw error;
    }
  }
}
