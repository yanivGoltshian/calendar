import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { computeCalendarSyncStatus } from './calendarConfig';
import { getFreeBusy, type BusyInterval } from './calendarClient';
import { getConnectionByStaffId, getFreshAccessToken, recordSyncError, recordSyncOk } from '@/server/repos/calendarConnection';
import { BookingError } from '@/server/booking/policy';

type ConnectionIdentity = {
  id: string; businessId: string; calendarId: string; googleEmail: string | null;
  refreshTokenEnc: string; importBusy: boolean;
};

function fingerprint(connection: ConnectionIdentity | null): string {
  return createHash('sha256').update(JSON.stringify(connection && [
    connection.id, connection.businessId, connection.calendarId, connection.googleEmail,
    connection.refreshTokenEnc, connection.importBusy,
  ])).digest('hex');
}

export type CalendarBusySnapshot = {
  enabled: boolean;
  staffId: string;
  identity: string;
  checkedAt: number;
  timeMin: Date;
  timeMax: Date;
  intervals: BusyInterval[];
};

/** External I/O happens before the booking transaction; failures never mean an empty calendar. */
export async function captureGoogleBusy(
  businessId: string | undefined, staffId: string, timeMin: Date, timeMax: Date,
): Promise<CalendarBusySnapshot> {
  const config = computeCalendarSyncStatus();
  const connection = config.enabled ? await getConnectionByStaffId(staffId) : null;
  if (businessId && connection && connection.businessId !== businessId)
    throw new BookingError('invalid_staff');
  const snapshot: CalendarBusySnapshot = {
    enabled: config.enabled, staffId, identity: fingerprint(connection),
    checkedAt: Date.now(), timeMin, timeMax, intervals: [],
  };
  if (!connection?.importBusy) return snapshot;
  try {
    if (!config.credentials) throw new Error('calendar_credentials_unavailable');
    const accessToken = await getFreshAccessToken(connection);
    if (!accessToken) throw new Error('calendar_token_unavailable');
    snapshot.intervals = await getFreeBusy({ accessToken, calendarId: connection.calendarId, timeMin, timeMax });
    snapshot.checkedAt = Date.now();
    await recordSyncOk(staffId);
    return snapshot;
  } catch {
    await recordSyncError(staffId, 'calendar_busy_unavailable');
    console.warn(JSON.stringify({ event: 'calendar_busy_denied', staffId, reason: 'lookup_failed' }));
    throw new BookingError('calendar_unavailable', 503);
  }
}

/** Recheck freshness, connection identity and interval inside the serializable commit. */
export async function assertGoogleBusySnapshot(
  snapshot: CalendarBusySnapshot, db: Prisma.TransactionClient, startAt: Date, endAt: Date,
) {
  if (snapshot.enabled !== computeCalendarSyncStatus().enabled ||
      Date.now() - snapshot.checkedAt > 30_000 ||
      startAt < snapshot.timeMin || endAt > snapshot.timeMax)
    throw new BookingError('calendar_snapshot_stale', 503);
  if (snapshot.enabled) {
    const connection = await db.staffCalendarConnection.findUnique({ where: { staffId: snapshot.staffId } });
    if (fingerprint(connection) !== snapshot.identity)
      throw new BookingError('calendar_snapshot_stale', 503);
  }
  if (snapshot.intervals.some((busy) => busy.startAt < endAt && busy.endAt > startAt))
    throw new BookingError('slot_taken', 409);
}

export async function getGoogleBusyIntervals(staffId: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
  return (await captureGoogleBusy(undefined, staffId, timeMin, timeMax)).intervals;
}
