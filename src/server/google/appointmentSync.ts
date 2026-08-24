import { prisma } from '@/lib/db';
import { isCalendarSyncEnabled } from '@/server/google/calendarConfig';
import { insertEvent, deleteEvent } from '@/server/google/calendarClient';
import {
  getConnectionByStaffId,
  getFreshAccessToken,
  recordSyncError,
  recordSyncOk,
} from '@/server/repos/calendarConnection';
import { setGoogleCalendarEventId } from '@/server/repos/appointments';

/**
 * מודול ייצוא תורים ליומן Google של בעל העסק.
 *
 * עקרונות: (1) שער env בראש כל פונקציה — כשכבוי אין גישת DB. (2) אידמפוטנטי:
 * יצירה מדלגת אם כבר קיים מזהה אירוע; מחיקה מדלגת אם אין. (3) כשל מוחלט —
 * לעולם לא זורק (נקרא ב-fire-and-forget), רק רושם שגיאה best-effort. (4) הכיבוי
 * הפרטני (exportBookings=false) מכובד.
 */

function buildTitle(clientName: string | null | undefined, serviceNames: string[]): string {
  const services = serviceNames.filter(Boolean).join(', ');
  const name = (clientName ?? '').trim();
  if (name && services) return `${name} · ${services}`;
  if (name) return name;
  if (services) return services;
  return 'תור';
}

/** יצירת אירוע ביומן הבעלים בעת קביעת תור. אידמפוטנטי מול googleCalendarEventId. */
export async function exportOnCreate(appointmentId: string): Promise<void> {
  if (!isCalendarSyncEnabled(process.env)) return;

  let staffId: string | null = null;
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        services: { select: { nameSnapshot: true } },
        client: { select: { name: true, phone: true } },
        business: { select: { name: true, address: true, timezone: true } },
      },
    });
    if (!appt) return;
    staffId = appt.staffId;
    if (appt.googleCalendarEventId) return; // כבר יוצא — אידמפוטנטי

    const conn = await getConnectionByStaffId(appt.staffId);
    if (!conn || !conn.exportBookings) return;

    const accessToken = await getFreshAccessToken(conn);
    if (!accessToken) return;

    const serviceNames = appt.services.map((s) => s.nameSnapshot);
    const detailLines: string[] = [];
    if (appt.client?.name) detailLines.push(`לקוח: ${appt.client.name}`);
    if (appt.client?.phone) detailLines.push(`טלפון: ${appt.client.phone}`);
    if (serviceNames.length > 0) detailLines.push(`שירות: ${serviceNames.join(', ')}`);
    if (appt.notes) detailLines.push(`הערות: ${appt.notes}`);

    const eventId = await insertEvent({
      accessToken,
      calendarId: conn.calendarId,
      event: {
        summary: buildTitle(appt.client?.name, serviceNames),
        description: detailLines.length > 0 ? detailLines.join('\n') : undefined,
        location: appt.business?.address ?? appt.business?.name ?? undefined,
        start: appt.startAt,
        end: appt.endAt,
        timeZone: appt.business?.timezone,
      },
    });

    await setGoogleCalendarEventId(appointmentId, eventId);
    await recordSyncOk(appt.staffId);
  } catch (err) {
    if (staffId) await recordSyncError(staffId, `export_create_failed:${(err as Error).message}`);
  }
}

/** מחיקת האירוע המיוצא בעת ביטול תור. מדלג אם אין מזהה אירוע. */
export async function exportOnCancel(appointmentId: string): Promise<void> {
  if (!isCalendarSyncEnabled(process.env)) return;

  let staffId: string | null = null;
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { staffId: true, googleCalendarEventId: true },
    });
    if (!appt) return;
    staffId = appt.staffId;
    if (!appt.googleCalendarEventId) return; // לא יוצא — אין מה למחוק

    const conn = await getConnectionByStaffId(appt.staffId);
    if (!conn) return;

    const accessToken = await getFreshAccessToken(conn);
    if (!accessToken) return;

    await deleteEvent({
      accessToken,
      calendarId: conn.calendarId,
      eventId: appt.googleCalendarEventId,
    });

    await setGoogleCalendarEventId(appointmentId, null);
    await recordSyncOk(appt.staffId);
  } catch (err) {
    if (staffId) await recordSyncError(staffId, `export_cancel_failed:${(err as Error).message}`);
  }
}
