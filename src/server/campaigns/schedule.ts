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
