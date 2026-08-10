import { prisma } from '@/lib/db';
import type { ReminderChannel } from '@prisma/client';

/** יצירת תזכורת מתוזמנת לתור (ברירת מחדל: SMS). ה-worker לשליחה יבוא במיילסטון הבא. */
export function createReminder(
  appointmentId: string,
  sendAt: Date,
  channel: ReminderChannel = 'SMS',
) {
  return prisma.reminder.create({
    data: { appointmentId, sendAt, channel },
  });
}

/** תזכורות שהגיע מועד שליחתן וטרם נשלחו (עבור ה-worker העתידי). */
export function getDueReminders(now: Date = new Date()) {
  return prisma.reminder.findMany({
    where: { status: 'SCHEDULED', sendAt: { lte: now } },
    include: { appointment: { include: { client: true, staff: true } } },
  });
}
