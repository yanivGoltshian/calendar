'use server';

import { revalidatePath } from 'next/cache';
import { getActiveBusiness } from '@/server/repos/business';
import {
  getAppointmentById,
  updateAppointmentStatus,
} from '@/server/repos/appointments';
import { canSendPaidClientSms, getBusinessAccess } from '@/server/subscription';
import { notifyClientOfApproval } from '@/server/notifications/clientApproval';
import { exportOnCreate, exportOnCancel } from '@/server/google/appointmentSync';
import { canEmailClients } from '@/server/tier';
import { absoluteUrl } from '@/lib/seo';

/**
 * פעולות מודול ההזמנות בניהול. שתיהן מאמתות שהתור משויך לעסק הפעיל
 * לפני שינוי סטטוס, וממחזרות את עמוד ההזמנות ואת היומן.
 */

async function assertBelongsToBusiness(id: string): Promise<boolean> {
  if (!id) return false;
  const business = await getActiveBusiness();
  if (!business) return false;
  const appt = await getAppointmentById(id);
  return appt?.businessId === business.id;
}

/**
 * אישור תור ממתין (סטטוס → CONFIRMED) והתראת הלקוח על האישור.
 * האימות והשינוי קורים תחילה; התראת הלקוח היא מיטבית ולעולם אינה חוסמת
 * את האישור (כל כשל ערוץ נבלע בתוך notifyClientOfApproval).
 */
export async function approveAppointmentAction(formData: FormData) {
  const id = String(formData.get('appointmentId') || '');
  if (!id) return;
  const business = await getActiveBusiness();
  if (!business) return;
  const appt = await getAppointmentById(id);
  if (appt?.businessId !== business.id) return;

  // מודיעים ללקוח רק כשמדובר באישור אמיתי של תור שהמתין לאישור.
  const wasPending = appt.status === 'PENDING';

  await updateAppointmentStatus(id, 'CONFIRMED');
  // ייצוא/עדכון האירוע ביומן הבעלים (fire-and-forget, אידמפוטנטי).
  void exportOnCreate(id).catch(() => {});
  revalidatePath('/admin/appointments');
  revalidatePath('/admin');

  if (!wasPending) return;

  // ערוצי התקשורת נגזרים מהמסלול (tier) בזמן ריצה, כך ששדרוג משתקף מיד. המנוי חייב
  // להיות פעיל כדי לפתוח ערוצים בתשלום. המסרון בתשלום שמור לאקסקלוסיב בלבד.
  const access = getBusinessAccess(business);
  const canEmail = access.active && canEmailClients(business.plan);
  const isExclusive = canSendPaidClientSms(business);

  try {
    await notifyClientOfApproval({
      appointmentId: appt.id,
      businessId: business.id,
      businessName: business.name,
      clientId: appt.client.id,
      clientName: appt.client.name,
      clientEmail: appt.client.email,
      clientPhone: appt.client.phone,
      services: appt.services.map((s) => ({ name: s.nameSnapshot })),
      startAt: appt.startAt,
      timezone: business.timezone,
      canEmail,
      isExclusive,
      manageUrl: absoluteUrl(`/b/${business.slug}`),
    });
  } catch {
    // התור כבר אושר והוחזר בהצלחה; כשל התראה אינו משפיע על הפעולה.
  }
}

/** ביטול תור מתוך מודול ההזמנות (סטטוס → CANCELLED). */
export async function cancelAppointmentAction(formData: FormData) {
  const id = String(formData.get('appointmentId') || '');
  if (!(await assertBelongsToBusiness(id))) return;
  await updateAppointmentStatus(id, 'CANCELLED');
  // מחיקת האירוע המיוצא מיומן הבעלים (fire-and-forget, מדלג אם אין).
  void exportOnCancel(id).catch(() => {});
  revalidatePath('/admin/appointments');
  revalidatePath('/admin');
}
