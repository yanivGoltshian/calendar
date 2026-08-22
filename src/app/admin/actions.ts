'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { AppointmentStatus } from '@prisma/client';
import { auth, signOut } from '@/auth';
import {
  getActiveBusiness,
  getBusinessesOwnedByEmail,
  requestBusinessDeletion,
  findRestorableBusinessForOwner,
  restoreBusiness,
} from '@/server/repos/business';
import { getServicesByIds } from '@/server/repos/services';
import {
  createAppointment,
  hasConflict,
  updateAppointmentStatus,
} from '@/server/repos/appointments';
import { findOrCreateClient } from '@/server/repos/clients';
import { createReminder } from '@/server/repos/reminders';
import { localWallTimeToUtc } from '@/lib/time';
import { normalizePhone } from '@/lib/crypto';

const STATUS_VALUES = [
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'CANCELLED',
  'NO_SHOW',
  'DONE',
] as const satisfies readonly AppointmentStatus[];

/** שינוי סטטוס תור מהיומן (מאושר/הגיע/בוטל/הברזה/הושלם/ממתין). */
export async function setAppointmentStatusAction(
  appointmentId: string,
  status: string,
): Promise<{ ok: boolean }> {
  if (!appointmentId) return { ok: false };
  if (!(STATUS_VALUES as readonly string[]).includes(status)) {
    return { ok: false };
  }
  await updateAppointmentStatus(appointmentId, status as AppointmentStatus);
  revalidatePath('/admin');
  return { ok: true };
}

const createSchema = z.object({
  staffId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  clientName: z.string().trim().min(1),
  clientPhone: z.string().trim().min(1),
  serviceId: z.string().min(1),
});

export type CreateApptState = { ok: boolean; error?: string };

/** יצירת תור ידנית מתוך יומן הניהול (חתימת useActionState). */
export async function createManualAppointmentAction(
  _prev: CreateApptState,
  formData: FormData,
): Promise<CreateApptState> {
  const parsed = createSchema.safeParse({
    staffId: formData.get('staffId'),
    date: formData.get('date'),
    time: formData.get('time'),
    clientName: formData.get('clientName'),
    clientPhone: formData.get('clientPhone'),
    serviceId: formData.get('serviceId'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'bad_request' };
  }
  const data = parsed.data;

  const business = await getActiveBusiness();
  if (!business) return { ok: false, error: 'no_business' };

  const services = await getServicesByIds(business.id, [data.serviceId]);
  if (services.length === 0) return { ok: false, error: 'invalid_service' };

  const [y, m, d] = data.date.split('-').map(Number);
  const [hh, mm] = data.time.split(':').map(Number);
  const startAt = localWallTimeToUtc(y, m, d, hh * 60 + mm, business.timezone);
  const totalDuration = services.reduce((s, svc) => s + svc.durationMin, 0);
  const totalPrice = services.reduce((s, svc) => s + svc.priceAgorot, 0);
  const endAt = new Date(startAt.getTime() + totalDuration * 60_000);

  if (await hasConflict(data.staffId, startAt, endAt)) {
    return { ok: false, error: 'slot_taken' };
  }

  const client = await findOrCreateClient({
    businessId: business.id,
    phone: normalizePhone(data.clientPhone),
    name: data.clientName,
  });

  const appointment = await createAppointment({
    businessId: business.id,
    clientId: client.id,
    staffId: data.staffId,
    startAt,
    endAt,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.durationMin,
      priceAgorot: s.priceAgorot,
    })),
    totalPriceAgorot: totalPrice,
  });

  const sendAt = new Date(
    Math.max(startAt.getTime() - 24 * 60 * 60 * 1000, Date.now() + 60_000),
  );
  await createReminder(appointment.id, sendAt);

  revalidatePath('/admin');
  return { ok: true };
}

/**
 * התנתקות בעל העסק דרך Auth.js (NextAuth v5): מנקה את עוגיית ה-session של הבעלים
 * (__Secure-authjs.session-token) ומפנה למסך כניסת הבעלים. זו ההתנתקות הנכונה
 * לאזור הניהול, בשונה מהתנתקות הלקוח שמנקה רק את עוגיית הלקוח.
 */
export async function ownerLogout(): Promise<void> {
  await signOut({ redirectTo: '/business/login' });
}

/**
 * בקשת מחיקת מנוי מאזור הניהול. מאמת שהקורא הוא בעל עסק מחובר, מסמן את העסק
 * PENDING_DELETION עם מועד מחיקה של 14 ימי עסקים, ומיד מנתק את הבעלים. מרגע זה
 * העמוד הציבורי מוסתר ואזור הניהול מוחלף במסך שחזור, עד לשחזור או למחיקה סופית.
 * שומר על אימות מכוון: מוחק רק כשהטופס כולל אישור מפורש (confirm=yes), כהגנה
 * נוספת מפני שליחה בשוגג.
 */
export async function requestAccountDeletion(formData: FormData): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect('/business/login?redirect=/admin/settings');

  // אישור מפורש מהטופס (תיבת הסימון) — בלעדיו חוזרים להגדרות בלי למחוק.
  if (formData.get('confirm') !== 'yes') {
    redirect('/admin/settings');
  }

  const owned = await getBusinessesOwnedByEmail(email);
  const business = owned[0];
  if (!business) redirect('/admin');

  // אידמפוטנטי: אם כבר סומן למחיקה, מדלגים על סימון חוזר ורק מנתקים.
  if (business.accountStatus !== 'PENDING_DELETION') {
    await requestBusinessDeletion(business.id);
  }

  // ניתוק מיידי של הבעלים (השבתה בפועל) והפניה למסך הכניסה.
  await signOut({ redirectTo: '/business/login?deleted=1' });
}

export type RestoreState = { ok: boolean; error?: string };

/**
 * שחזור מנוי ממצב PENDING_DELETION. מאמת שהמייל המחובר הוא בעל עסק שממתין למחיקה,
 * שמספר הטלפון שהוזן תואם לזה שנשמר (כשקיים), ושמועד המחיקה טרם עבר, ואז מחזיר
 * את העסק ל-ACTIVE עם כל הנתונים ומפנה חזרה לאזור הניהול.
 */
export async function restoreAccountAction(
  _prev: RestoreState,
  formData: FormData,
): Promise<RestoreState> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, error: 'unauthorized' };

  const phone = String(formData.get('phone') || '').trim();
  const restorable = await findRestorableBusinessForOwner(email, phone || null);
  if (!restorable) return { ok: false, error: 'no_match' };

  await restoreBusiness(restorable.id);
  revalidatePath('/admin');
  redirect('/admin');
}
