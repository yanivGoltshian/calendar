'use server';

import { redirect } from 'next/navigation';
import { clearClientSession } from '@/lib/session';

/** התנתקות: ניקוי עוגיית ה-session והפניה למסך ההתחברות. */
export async function logout() {
  await clearClientSession();
  redirect('/login');
}
