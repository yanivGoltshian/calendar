import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
import AdminSidebar from './AdminSidebar';

export const dynamic = 'force-dynamic';

/**
 * שלד אזור הניהול (RTL): סרגל צד בפלטת נייבי-זהב + אזור תוכן.
 * העמודים עצמם מספקים את ה-<main> שלהם, ולכן העטיפה כאן היא <div> בלבד
 * כדי למנוע קינון של <main> בתוך <main>.
 *
 * שער בעלות: אזור הניהול פתוח רק לבעל עסק מאומת (NextAuth).
 * לא מאומת -> כניסת בעלים; מאומת בלי עסק -> זרימת הקמת עסק.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect('/business/login?redirect=/admin');
  }

  const owned = await getBusinessesOwnedByEmail(email);
  if (owned.length === 0) {
    redirect('/business/new');
  }

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
