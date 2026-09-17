import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  BusinessReviewError,
  manualReviewSchema,
  reviewEditSchema,
  reviewInputSchema,
  type AdminBusinessReview,
  type PublicBusinessReview,
  type ReviewInput,
} from '@/lib/businessReviews';

const eligibleAppointmentWhere = (businessId: string, userId: string) => ({
  businessId,
  business: { accountStatus: 'ACTIVE' as const },
  status: 'DONE' as const,
  endAt: { lte: new Date() },
  client: { businessId, userId, identityVerifiedAt: { not: null } },
});

export async function getReviewEligibility(businessId: string, userId: string) {
  const [appointments, submitted] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...eligibleAppointmentWhere(businessId, userId), review: null },
      select: {
        id: true,
        startAt: true,
        client: { select: { name: true } },
        services: { select: { nameSnapshot: true } },
      },
      orderBy: { startAt: 'desc' },
    }),
    prisma.businessReview.findMany({
      where: { businessId, authorUserId: userId, origin: 'CUSTOMER' },
      select: { id: true, status: true },
    }),
  ]);
  return { appointments, submitted };
}

export async function submitCustomerReview(
  businessId: string,
  userId: string,
  appointmentId: string,
  input: ReviewInput,
) {
  const data = reviewInputSchema.parse(input);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const appointment = await tx.appointment.findFirst({
          where: { id: appointmentId, ...eligibleAppointmentWhere(businessId, userId) },
          select: { id: true },
        });
        if (!appointment) throw new BusinessReviewError('ineligible');
        const existing = await tx.businessReview.findUnique({ where: { appointmentId } });
        if (existing) throw new BusinessReviewError('already_submitted');
        return tx.businessReview.create({
          data: {
            ...data,
            originalText: data.text,
            businessId,
            authorUserId: userId,
            appointmentId,
            origin: 'CUSTOMER',
            status: 'PENDING',
          },
          select: { id: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new BusinessReviewError('already_submitted');
      if (error.code === 'P2034') throw new BusinessReviewError('conflict');
    }
    throw error;
  }
}

export async function addManualReview(businessId: string, input: unknown) {
  const { requestKey, ...data } = manualReviewSchema.parse(input);
  const requestHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  try {
    const review = await prisma.businessReview.create({
      data: {
        ...data,
        originalText: data.text,
        businessId,
        origin: 'OWNER',
        requestKey,
        requestHash,
      },
      select: { id: true, status: true },
    });
    return { ...review, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.businessReview.findUnique({
        where: { businessId_requestKey: { businessId, requestKey } },
        select: { id: true, status: true, requestHash: true },
      });
      if (existing?.requestHash === requestHash) {
        return { id: existing.id, status: existing.status, created: false };
      }
      throw new BusinessReviewError('conflict');
    }
    throw error;
  }
}

export async function updateBusinessReview(businessId: string, input: unknown) {
  const { id, version, ...data } = reviewEditSchema.parse(input);
  const existing = await prisma.businessReview.findFirst({
    where: { id, businessId },
    select: { origin: true, rating: true },
  });
  if (!existing) throw new BusinessReviewError('not_found');
  if (existing.origin === 'CUSTOMER' && data.rating !== existing.rating) {
    throw new BusinessReviewError('rating_locked');
  }
  const result = await prisma.businessReview.updateMany({
    where: { id, businessId, version },
    data: {
      text: data.text,
      status: data.status,
      ...(existing.origin === 'OWNER' ? { rating: data.rating } : {}),
      version: { increment: 1 },
    },
  });
  if (result.count !== 1) throw new BusinessReviewError('conflict');
  return { id };
}

export async function listAdminBusinessReviews(
  businessId: string,
): Promise<AdminBusinessReview[]> {
  const rows = await prisma.businessReview.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      rating: true,
      originalText: true,
      text: true,
      origin: true,
      status: true,
      version: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function countPendingBusinessReviews(businessId: string) {
  return prisma.businessReview.count({ where: { businessId, status: 'PENDING' } });
}

export async function listPublicBusinessReviews(
  businessId: string,
): Promise<PublicBusinessReview[]> {
  const rows = await prisma.businessReview.findMany({
    where: { businessId, status: 'PUBLISHED', business: { accountStatus: 'ACTIVE' } },
    select: {
      id: true,
      name: true,
      rating: true,
      text: true,
      originalText: true,
      origin: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((row) => {
    const editedByBusiness = row.origin === 'CUSTOMER' && row.text !== row.originalText;
    return {
      id: row.id,
      name: row.name,
      rating: row.rating,
      quote: row.text,
      editedByBusiness,
      ...(editedByBusiness ? { originalQuote: row.originalText } : {}),
    };
  });
}
