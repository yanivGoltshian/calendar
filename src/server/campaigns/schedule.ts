import { DEFAULT_TZ, localWallTimeToUtc, utcToLocalParts } from '@/lib/time';

/**
 * לוגיקת תזמון קמפיינים — טהורה וחפה מ-DB, ניתנת לבדיקה בקלות.
 *
 * קמפיין מתוזמן "בשל" למסירה כאשר הסטטוס שלו הוא SCHEDULED, יש לו זמן תזמון
 * (scheduledAt) והזמן הזה כבר הגיע או חלף ביחס ל"עכשיו". ה-cron מרים את כל
 * הקמפיינים הבשלים ושולח אותם.
 */

/** צורת הקמפיין המינימלית הנדרשת להכרעת בשלות תזמון. */
export interface SchedulableCampaign {
  status: string;
  scheduledAt: Date | null;
}

export function parseCampaignScheduledAt(raw: string, timeZone = DEFAULT_TZ): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const [year, month1, day, hour, minute] = [y, mo, d, h, mi].map(Number);
  if (
    year < 1 ||
    month1 < 1 ||
    month1 > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const minutes = hour * 60 + minute;
  const instant = localWallTimeToUtc(year, month1, day, minutes, timeZone);
  const local = utcToLocalParts(instant, timeZone);
  return local.year === year &&
    local.month1 === month1 &&
    local.day === day &&
    local.minutes === minutes
    ? instant
    : null;
}

/**
 * האם קמפיין מתוזמן בשל לשליחה נכון לרגע `now`.
 * דורש סטטוס SCHEDULED, קיום scheduledAt ו-scheduledAt <= now.
 */
export function isCampaignDue(campaign: SchedulableCampaign, now: Date): boolean {
  return (
    campaign.status === 'SCHEDULED' &&
    campaign.scheduledAt != null &&
    campaign.scheduledAt.getTime() <= now.getTime()
  );
}
