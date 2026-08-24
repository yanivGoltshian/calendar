'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
import {
  deleteConnection,
  setConnectionToggles,
  resolveOwnerStaffId,
} from '@/server/repos/calendarConnection';

/**
 * פעולות ניהול חיבור יומן Google של הבעלים.
 *
 * שער בעלות מחמיר: מאמתים session + בעלות במייל ופותרים את איש הצוות של הבעלים,
 * במקום getActiveBusiness שנופל לאורח — כדי שפעולות משנות מצב לא ייחשפו ללא זיהוי.
 */
async function resolveOwnerContext(): Promise<{ staffId: string } | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const [business] = await getBusinessesOwnedByEmail(email);
  if (!business) return null;
  const staffId = await resolveOwnerStaffId({
    id: business.id,
    ownerEmail: business.ownerEmail ?? email,
    name: business.name,
  });
  return { staffId };
}

/** ניתוק יומן Google (מחיקת החיבור המוצפן). אידמפוטנטי. */
export async function disconnectCalendarAction(): Promise<void> {
  const ctx = await resolveOwnerContext();
  if (!ctx) return;
  await deleteConnection(ctx.staffId);
  revalidatePath('/admin/settings');
}

/**
 * עדכון מתג בודד (importBusy / exportBookings). כל מתג נשלח כטופס עם field+value
 * מפורשים, כדי להימנע מדו־משמעות של checkbox לא-מסומן (שלא נשלח כלל).
 */
export async function setCalendarToggleAction(formData: FormData): Promise<void> {
  const ctx = await resolveOwnerContext();
  if (!ctx) return;

  const field = String(formData.get('field') || '');
  const value = String(formData.get('value') || '') === 'true';

  if (field === 'importBusy') {
    await setConnectionToggles(ctx.staffId, { importBusy: value });
  } else if (field === 'exportBookings') {
    await setConnectionToggles(ctx.staffId, { exportBookings: value });
  } else {
    return;
  }
  revalidatePath('/admin/settings');
}
