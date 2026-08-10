import type { ReactNode } from 'react';
import AdminSidebar from './AdminSidebar';

/**
 * שלד אזור הניהול (RTL): סרגל צד בפלטת נייבי-זהב + אזור תוכן.
 * העמודים עצמם מספקים את ה-<main> שלהם, ולכן העטיפה כאן היא <div> בלבד
 * כדי למנוע קינון של <main> בתוך <main>.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
