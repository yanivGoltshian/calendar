import { prisma } from '@/lib/db';

/** אנשי צוות פעילים בעסק. */
export function listStaff(businessId: string) {
  return prisma.staffMember.findMany({
    where: { businessId, active: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** איש צוות בודד עם שעות העבודה שלו. */
export function getStaffWithHours(staffId: string) {
  return prisma.staffMember.findUnique({
    where: { id: staffId },
    include: { workingHours: true },
  });
}

/** שעות העבודה של איש צוות. */
export function getStaffWorkingHours(staffId: string) {
  return prisma.workingHours.findMany({
    where: { staffId },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
  });
}
