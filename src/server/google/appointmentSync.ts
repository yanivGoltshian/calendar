import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { isCalendarSyncEnabled } from '@/server/google/calendarConfig';
import { insertEvent, deleteEvent } from '@/server/google/calendarClient';
import {
  getConnectionByStaffId, getFreshAccessToken, recordSyncError, recordSyncOk,
} from '@/server/repos/calendarConnection';

export function appointmentGoogleEventId(id: string) {
  return createHash('sha256').update(`tor-chick:appointment:${id}`).digest('hex');
}

export type CalendarSyncDeps = {
  insertEvent?: typeof insertEvent;
  deleteEvent?: typeof deleteEvent;
  getConnection?: (staffId: string) => Promise<Awaited<ReturnType<typeof getConnectionByStaffId>>>;
  getAccessToken?: typeof getFreshAccessToken;
  recordOk?: (staffId: string) => Promise<unknown>;
  recordError?: (staffId: string, error: string) => Promise<unknown>;
};

/** Reconcile current desired state, not whichever callback happened to run last. */
export async function reconcileAppointmentCalendar(id: string, deps: CalendarSyncDeps = {}) {
  if (!isCalendarSyncEnabled(process.env)) return;
  const token = randomUUID();
  let staffId: string | undefined;
  const claimed = await prisma.appointment.updateMany({
    where: {
      id, googleSyncPending: true,
      OR: [{ googleSyncClaimToken: null }, { googleSyncClaimedAt: { lt: new Date(Date.now() - 300000) } }],
    },
    data: { googleSyncClaimToken: token, googleSyncClaimedAt: new Date() },
  });
  if (!claimed.count) return;
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id }, include: { services: true, client: true, business: true },
    });
    if (!appt) return;
    staffId = appt.staffId;
    const conn = await (deps.getConnection ?? getConnectionByStaffId)(staffId);
    if (!conn) return;
    const accessToken = await (deps.getAccessToken ?? getFreshAccessToken)(conn);
    if (!accessToken) return;
    const eventId = appt.googleCalendarEventId ?? appointmentGoogleEventId(id);
    const mustDelete = appt.status === 'CANCELLED' || appt.business.accountStatus !== 'ACTIVE';
    if (!mustDelete && (!conn.exportBookings || appt.status !== 'CONFIRMED')) return;

    // Persist the deterministic target before contacting Google. A lost response
    // or process crash always leaves enough information for the next worker.
    await prisma.appointment.updateMany({
      where: { id, googleSyncClaimToken: token },
      data: { googleCalendarEventId: eventId },
    });
    const remove = () => (deps.deleteEvent ?? deleteEvent)({
      accessToken, calendarId: conn.calendarId, eventId,
    });
    if (mustDelete) {
      await remove();
    } else {
      const services = appt.services.map((s) => s.nameSnapshot).filter(Boolean).join(', ');
      await (deps.insertEvent ?? insertEvent)({
        accessToken, calendarId: conn.calendarId,
        event: {
          id: eventId, summary: [appt.client.name, services].filter(Boolean).join(' · ') || 'תור',
          location: appt.business.address ?? appt.business.name,
          start: appt.startAt, end: appt.endAt, timeZone: appt.business.timezone,
        },
      });
    }
    // Cancellation can commit while insertEvent is in flight. Compensate before
    // finalizing; a further racing state change makes the CAS fail and stays pending.
    const latest = await prisma.appointment.findUnique({ where: { id }, include: { business: true } });
    if (!latest) {
      if (!mustDelete) await remove();
      return;
    }
    const deleteNow = latest.status === 'CANCELLED' || latest.business.accountStatus !== 'ACTIVE';
    if (deleteNow && !mustDelete) await remove();
    if (mustDelete && !deleteNow) return;
    await prisma.appointment.updateMany({
      where: {
        id, googleSyncClaimToken: token, status: latest.status,
        business: { accountStatus: latest.business.accountStatus },
      },
      data: { googleCalendarEventId: deleteNow ? null : eventId, googleSyncPending: false },
    });
    await (deps.recordOk ?? recordSyncOk)(staffId);
  } catch (error) {
    if (staffId) await (deps.recordError ?? recordSyncError)(staffId, 'appointment_reconciliation_failed').catch(() => undefined);
  } finally {
    await prisma.appointment.updateMany({
      where: { id, googleSyncClaimToken: token },
      data: { googleSyncClaimToken: null, googleSyncClaimedAt: null },
    }).catch(() => undefined);
  }
}

async function scheduleReconciliation(id: string) {
  if (!isCalendarSyncEnabled(process.env)) return;
  try {
    await prisma.appointment.updateMany({ where: { id }, data: { googleSyncPending: true } });
    await reconcileAppointmentCalendar(id);
  } catch {
    // The booking/status transaction also writes this durable pending flag.
    console.error('[calendar] reconciliation deferred');
  }
}

export const exportOnCreate = scheduleReconciliation;
export const exportOnCancel = scheduleReconciliation;

export async function reconcilePendingCalendars(take = 50) {
  if (!isCalendarSyncEnabled(process.env)) return 0;
  const rows = await prisma.appointment.findMany({
    where: {
      googleSyncPending: true,
      staff: { calendarConnection: { isNot: null } },
      OR: [{ googleSyncClaimToken: null }, { googleSyncClaimedAt: { lt: new Date(Date.now() - 300000) } }],
    },
    orderBy: { updatedAt: 'asc' }, take, select: { id: true },
  });
  for (const row of rows) await reconcileAppointmentCalendar(row.id);
  return rows.length;
}
