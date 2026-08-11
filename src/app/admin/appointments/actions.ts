'use server';

import { revalidatePath } from 'next/cache';
import { getFirstBusiness } from '@/server/repos/business';
import {
  getAppointmentById,
  updateAppointmentStatus,
} from '@/server/repos/appointments';

/**
 * פעולות מודול ההזמנות בניהול. שתיהן מאמתות שהתור משויך לעסק הפעיל
 * לפני שינוי סטטוס, וממחזרות את עמוד ההזמנות ואת היומן.
 */

async function assertBelongsToBusiness(id: string): Promise<boolean> {
  if (!id) return false;
  const business = await getFirstBusiness();
  if (!business) return false;
  const appt = await getAppointmentById(id);
  return appt?.businessId === business.id;
}

/** אישור תור ממתין (סטטוס → CONFIRMED). */
export async function approveAppointmentAction(formData: FormData) {
  const id = String(formData.get('appointmentId') || '');
  if (!(await assertBelongsToBusiness(id))) return;
  await updateAppointmentStatus(id, 'CONFIRMED');
  revalidatePath('/admin/appointments');
  revalidatePath('/admin');
}

/** ביטול תור מתוך מודול ההזמנות (סטטוס → CANCELLED). */
export async function cancelAppointmentAction(formData: FormData) {
  const id = String(formData.get('appointmentId') || '');
  if (!(await assertBelongsToBusiness(id))) return;
  await updateAppointmentStatus(id, 'CANCELLED');
  revalidatePath('/admin/appointments');
  revalidatePath('/admin');
}
