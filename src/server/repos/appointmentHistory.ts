import { prisma } from '@/lib/db';
import { HISTORY_PAGE_SIZE, type HistoryCursor } from '@/lib/appointmentHistory';
import { historyAppointmentSelect } from '@/server/appointmentHistory';

export async function getAppointmentHistory(
  userId: string,
  businessId: string,
  cursor: HistoryCursor | null,
  now = new Date(),
) {
  if (!userId) throw new Error('appointment_history_identity_required');
  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      client: { businessId, userId, identityVerifiedAt: { not: null } },
      startAt: { lt: now },
      ...(cursor
        ? {
            OR: [
              { startAt: { lt: new Date(cursor.startAt) } },
              { startAt: new Date(cursor.startAt), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    select: historyAppointmentSelect,
    orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
    take: HISTORY_PAGE_SIZE + 1,
  });
  const page = appointments.slice(0, HISTORY_PAGE_SIZE);
  const last = page.at(-1);
  return {
    appointments: page,
    nextCursor:
      appointments.length > HISTORY_PAGE_SIZE && last
        ? { startAt: last.startAt.toISOString(), id: last.id }
        : null,
  };
}
