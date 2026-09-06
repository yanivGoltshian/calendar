import { prisma } from '@/lib/db';
import { DEMO_SLUGS } from '@/lib/directory';

export function directoryWhere(now = new Date()) {
  return {
    listed: true,
    accountStatus: 'ACTIVE' as const,
    slug: { notIn: [...DEMO_SLUGS] },
    settings: { onboardingCompleted: true },
    OR: [
      { plan: 'basic' as const, trialEndsAt: { gt: now } },
      { plan: { in: ['premium', 'exclusive'] as ('premium' | 'exclusive')[] }, paidUntil: { gt: now } },
    ],
  };
}

export async function getListedBusinesses() {
  return prisma.business.findMany({
    where: directoryWhere(),
    select: { slug: true, name: true, description: true, address: true, updatedAt: true },
    orderBy: { name: 'asc' },
  });
}

export async function countListedBusinesses() {
  return prisma.business.count({ where: directoryWhere() });
}
