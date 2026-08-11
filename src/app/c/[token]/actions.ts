'use server';

import { revalidatePath } from 'next/cache';
import { setConfirmationStatusByToken } from '@/server/repos/appointments';

export type ConfirmDecision = 'CONFIRMED' | 'DECLINED';

export type ConfirmState = {
  done: boolean;
  status?: ConfirmDecision;
  error?: string;
};

/**
 * עדכון אישור ההגעה מצד הלקוח לפי טוקן ציבורי (חתימת useActionState).
 * מקבל decision מתוך הכפתור שנלחץ, מעדכן confirmationStatus, ומרענן את העמוד.
 * מחזיר תוצאה מובנית לתצוגה ידידותית בעברית, ללא זריקת חריגה.
 */
export async function submitConfirmation(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const token = String(formData.get('token') || '').trim();
  const rawDecision = String(formData.get('decision') || '').trim();

  if (rawDecision !== 'CONFIRMED' && rawDecision !== 'DECLINED') {
    return { done: false, error: 'bad_request' };
  }
  if (!token) {
    return { done: false, error: 'bad_request' };
  }
  const decision: ConfirmDecision = rawDecision;

  const updated = await setConfirmationStatusByToken(token, decision);
  if (!updated) {
    return { done: false, error: 'not_found' };
  }

  // רענון תצוגת המנהל והעמוד הציבורי כדי לשקף את הסטטוס המעודכן.
  revalidatePath(`/c/${token}`);
  revalidatePath('/admin/appointments');

  return { done: true, status: decision };
}
