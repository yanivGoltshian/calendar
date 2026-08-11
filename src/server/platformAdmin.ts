import { auth } from '@/auth';

/**
 * שער ניהול-על (סופר-אדמין).
 *
 * הגישה מותרת רק למיילים המופיעים ב-PLATFORM_ADMIN_EMAILS (מופרד בפסיקים).
 * ברירת המחדל כשהמשתנה לא מוגדר: yanivgolt@gmail.com בלבד.
 * ההשוואה חסרת רגישות לאותיות גדולות/קטנות ולרווחים.
 */

const DEFAULT_ADMIN_EMAILS = 'yanivgolt@gmail.com';

/** רשימת מיילים מנורמלים (lowercase) הרשאים לניהול-על. */
export function platformAdminEmails(): string[] {
  const raw = process.env.PLATFORM_ADMIN_EMAILS?.trim() || DEFAULT_ADMIN_EMAILS;
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** האם מייל נתון שייך לרשימת מנהלי הפלטפורמה. */
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * מחזיר את מייל מנהל-העל המאומת, או null אם ה-session אינו של מנהל.
 * לשימוש בשער העמוד ובכל server action (בדיקה חוזרת בצד השרת).
 */
export async function getPlatformAdminEmail(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  return isPlatformAdminEmail(email) ? email : null;
}
