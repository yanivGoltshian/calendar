import { isCalendarSyncEnabled } from '@/server/google/calendarConfig';
import { getFreeBusy, type BusyInterval } from '@/server/google/calendarClient';
import {
  getConnectionByStaffId,
  getFreshAccessToken,
  recordSyncError,
  recordSyncOk,
} from '@/server/repos/calendarConnection';

/**
 * מחזיר את מרווחי העומס מיומן Google של איש הצוות בטווח נתון (UTC), לשילוב
 * בחישוב הזמינות ומניעת חפיפה מול אירועים אישיים של הבעלים.
 *
 * עקרונות: (1) שער env בראש הפונקציה — כשהסנכרון כבוי אין שום גישת DB (נתיב חם).
 * (2) fail-open מוחלט — כל כשל (אין חיבור, רענון נכשל, timeout) מחזיר [] כדי שלא
 * לחסום הצגת משבצות. (3) הכיבוי הפרטני (importBusy=false) מכובד.
 */
export async function getGoogleBusyIntervals(
  staffId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyInterval[]> {
  if (!isCalendarSyncEnabled(process.env)) return [];

  try {
    const conn = await getConnectionByStaffId(staffId);
    if (!conn || !conn.importBusy) return [];

    const accessToken = await getFreshAccessToken(conn);
    if (!accessToken) return [];

    const intervals = await getFreeBusy({
      accessToken,
      calendarId: conn.calendarId,
      timeMin,
      timeMax,
    });
    await recordSyncOk(staffId);
    return intervals;
  } catch (err) {
    await recordSyncError(staffId, `import_failed:${(err as Error).message}`);
    return [];
  }
}
