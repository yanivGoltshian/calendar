'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { clearClientSession, getClientSession } from '@/lib/session';
import {
  getAppointmentForOwner,
  updateAppointmentStatus,
} from '@/server/repos/appointments';
import {
  deleteUserAccount,
  getAccountDeletionInfo,
} from '@/server/repos/account';

/** התנתקות: ניקוי עוגיית ה-session והפניה למסך ההתחברות. */
export async function logout() {
  await clearClientSession();
  redirect('/login');
}

export type CancelState = { ok: boolean; error?: string };

/**
 * ביטול תור בידי הלקוח (חתימת useActionState).
 * מאמת בעלות (userId או טלפון), סטטוס הניתן לביטול, ואת חלון הביטול של העסק.
 */
export async function cancelAppointmentAction(
  _prev: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const session = await getClientSession();
  if (!session) return { ok: false, error: 'unauthorized' };

  const id = String(formData.get('appointmentId') || '');
  if (!id) return { ok: false, error: 'bad_request' };

  const appt = await getAppointmentForOwner(id);
  if (!appt) return { ok: false, error: 'not_found' };

  // אימות בעלות: התור חייב להשתייך למשתמש המחובר (לפי userId או טלפון).
  const owned =
    appt.client.userId === session.userId || appt.client.phone === session.phone;
  if (!owned) return { ok: false, error: 'forbidden' };

  // ניתן לבטל רק תור ממתין או מאושר שטרם התחיל.
  if (appt.status !== 'PENDING' && appt.status !== 'CONFIRMED') {
    return { ok: false, error: 'not_cancellable' };
  }

  // אכיפת חלון הביטול: אין לבטל בתוך X השעות שלפני מועד התור.
  const windowHours = appt.business.settings?.cancellationWindowHours ?? 24;
  const cutoff = appt.startAt.getTime() - windowHours * 60 * 60 * 1000;
  if (Date.now() > cutoff) {
    return { ok: false, error: 'window_passed' };
  }

  await updateAppointmentStatus(id, 'CANCELLED');
  revalidatePath('/account');
  // ריענון אופציונלי של עמוד העסק הציבורי כשהביטול מתבצע מתוך מקטע "שלום .."
  // (חייב להתחיל ב-/b/ כדי למנוע ריענון נתיב שרירותי).
  const extra = String(formData.get('revalidate') || '');
  if (extra.startsWith('/b/')) {
    revalidatePath(extra);
  }
  return { ok: true };
}

export type DeleteAccountState = { ok: boolean; error?: string };

/**
 * מחיקת חשבון הלקוח (חתימת useActionState).
 * הגנה: חשבון שהוא בעל עסק או איש צוות אינו נמחק כאן (מניעת ניתוק/יתום של עסק) —
 * מוחזרת הודעה המפנה לאזור ניהול העסק. אחרת נמחקת זהות המשתמש, מנוקה ה-session
 * ומתבצעת הפניה לעמוד הבית.
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  _formData: FormData,
): Promise<DeleteAccountState> {
  const session = await getClientSession();
  if (!session) return { ok: false, error: 'unauthorized' };

  const info = await getAccountDeletionInfo(session.userId);
  // אם המשתמש כבר אינו קיים — מנקים session ומסיימים בהצלחה.
  if (info) {
    if (info.ownedBusinesses > 0 || info.staffMemberships > 0) {
      return { ok: false, error: 'owner_blocked' };
    }
    try {
      await deleteUserAccount(session.userId);
    } catch {
      return { ok: false, error: 'delete_failed' };
    }
  }

  await clearClientSession();
  redirect('/?farewell=1');
}
