import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

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

export async function completeBusinessImport(
  businessId: string,
  sourceUrl: string,
  draft: Prisma.InputJsonValue,
) {
  return prisma.business.update({
    where: { id: businessId },
    data: {
      businessImportSourceUrl: sourceUrl,
      businessImportDraft: draft,
      businessImportedAt: new Date(),
    },
  });
}
