'use server';

import { revalidatePath } from 'next/cache';
import {
  createAppointment,
  getAppointmentById,
  hasConflict,
} from '@/server/repos/appointments';
import { findOrCreateClient } from '@/server/repos/clients';
import { createReminder } from '@/server/repos/reminders';
import {
  claimHeldEntry,
  getEntryByClaimToken,
} from '@/server/repos/waitlist';

export type ClaimResult = 'claimed' | 'expired' | 'taken' | 'not_found';

export type ClaimState = {
  done: boolean;
  result?: ClaimResult;
  error?: string;
};

/**
 * תפיסת משבצת שהתפנה מרשימת ההמתנה, לפי טוקן ציבורי (חתימת useActionState).
 * הזרימה: אימות ההחזקה (NOTIFIED בתוקף) → שליפת התור שבוטל שממנו נגזרה המשבצת →
 * בדיקת חפיפה מחדש → תפיסה אטומית (first-come) → יצירת לקוח ותור חדש + תזכורת.
 * לעולם אינו זורק חריגה — מחזיר תוצאה מובנית לתצוגה ידידותית בעברית.
 */
export async function claimSlot(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const token = String(formData.get('token') || '').trim();
  if (!token) {
    return { done: false, result: 'not_found' };
  }

  const entry = await getEntryByClaimToken(token);
  if (!entry) {
    return { done: false, result: 'not_found' };
  }

  // כבר נתפס בעבר (על ידי הלקוח או מישהו אחר).
  if (entry.status === 'BOOKED') {
    return { done: false, result: 'taken' };
  }

  // ההחזקה חייבת להיות פעילה: סטטוס NOTIFIED ומועד פקיעה עתידי.
  const now = Date.now();
  const holdActive =
    entry.status === 'NOTIFIED' &&
    !!entry.holdExpiresAt &&
    entry.holdExpiresAt.getTime() > now;
  if (!holdActive || !entry.heldAppointmentId) {
    return { done: false, result: 'expired' };
  }

  // המשבצת בפועל יושבת על התור שבוטל; בלעדיו אין מה לתפוס.
  const source = await getAppointmentById(entry.heldAppointmentId);
  if (!source) {
    return { done: false, result: 'expired' };
  }

  // בדיקת חפיפה אחרונה: ייתכן שמשבצת זו נתפסה בינתיים בהזמנה רגילה.
  if (await hasConflict(source.staffId, source.startAt, source.endAt)) {
    return { done: false, result: 'taken' };
  }

  // תפיסה אטומית (NOTIFIED → BOOKED, רק אם ההחזקה עדיין בתוקף). מנצח ראשון בלבד.
  const claimed = await claimHeldEntry(token);
  if (!claimed) {
    return { done: false, result: 'taken' };
  }

  // יצירת/איתור הלקוח מרשומת ההמתנה (טלפון כמעט תמיד קיים).
  const client = await findOrCreateClient({
    businessId: entry.businessId,
    phone: entry.phone,
    name: entry.name,
  });

  // יצירת התור החדש במשבצת שהתפנה, לפי snapshot השירותים של התור המקורי.
  // סטטוס CONFIRMED: הלקוח תפס משבצת פעילה שכבר הייתה מאושרת, ומיידית חוסם אותה.
  const appointment = await createAppointment({
    businessId: entry.businessId,
    clientId: client.id,
    staffId: source.staffId,
    startAt: source.startAt,
    endAt: source.endAt,
    services: source.services.map((s) => ({
      id: s.serviceId,
      name: s.nameSnapshot,
      durationMin: s.durationMinSnapshot,
      priceAgorot: s.priceAgorotSnapshot,
    })),
    totalPriceAgorot: source.totalPriceAgorot,
    status: 'CONFIRMED',
  });

  // תזכורת ברירת מחדל (24 שעות לפני, אך לא לפני עוד דקה). השליחה תמומש ב-worker.
  const reminderLeadMs = 24 * 60 * 60 * 1000;
  const sendAt = new Date(
    Math.max(source.startAt.getTime() - reminderLeadMs, Date.now() + 60_000),
  );
  try {
    await createReminder(appointment.id, sendAt);
  } catch {
    // התור כבר נוצר בהצלחה; כשל ביצירת תזכורת אינו משפיע על התפיסה.
  }

  revalidatePath(`/w/${token}`);
  revalidatePath('/admin/appointments');
  revalidatePath('/admin');

  return { done: true, result: 'claimed' };
}
