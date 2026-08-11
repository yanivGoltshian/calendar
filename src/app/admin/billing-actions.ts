'use server';

import { signOut } from '@/auth';

/**
 * התנתקות בעל העסק (NextAuth) ממסך ה-paywall.
 * שומר על גישה ליציאה גם כשאזור הניהול חסום בשל פקיעת מנוי/ניסיון.
 */
export async function signOutOwner() {
  await signOut({ redirectTo: '/' });
}
