import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';

export const dynamic = 'force-dynamic';

/**
 * נקודת המשך אחרי כניסת בעלים.
 * אין session -> חזרה לכניסת בעלים.
 * יש עסק בבעלות -> אזור הניהול.
 * מאומת בלי עסק -> זרימת הקמת עסק.
 */
export default async function BusinessResumePage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect('/business/login');
  }

  const owned = await getBusinessesOwnedByEmail(email);
  if (owned.length > 0) {
    redirect('/admin');
  }

  redirect('/business/new');
}
