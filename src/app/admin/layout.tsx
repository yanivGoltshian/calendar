import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
import { countPendingAppointments } from '@/server/repos/appointments';
import { getBusinessAccess } from '@/server/subscription';
import { isPlatformAdminEmail } from '@/server/platformAdmin';
import AdminSidebar from './AdminSidebar';
import { buildAdminNotifications } from './notifications';
import Paywall from './Paywall';
import TrialBanner from './TrialBanner';

export const dynamic = 'force-dynamic';

/**
 * מטא-דאטה לאזור הניהול: דורס את המניפסט הגלובלי עבור /admin/* ומצביע
 * על מניפסט ה-PWA הייעודי, כך שסביבת הניהול ניתנת להתקנה כאפליקציה עצמאית
 * (שם, id ו-scope נפרדים). ייצוא סטטי מותר לצד רכיב layout אסינכרוני.
 */
export const metadata: Metadata = {
  applicationName: 'תור צ׳יק · ניהול',
  manifest: '/admin/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'תור צ׳יק ניהול',
    statusBarStyle: 'default',
  },
};

/**
 * שלד אזור הניהול (RTL): סרגל צד בפלטת נייבי-זהב + אזור תוכן.
 * העמודים עצמם מספקים את ה-<main> שלהם, ולכן העטיפה כאן היא <div> בלבד
 * כדי למנוע קינון של <main> בתוך <main>.
 *
 * שער בעלות: אזור הניהול פתוח רק לבעל עסק מאומת (NextAuth).
 * לא מאומת -> כניסת בעלים; מנהל פלטפורמה -> קונסולת ניהול-העל (/superadmin);
 * מאומת בלי עסק -> זרימת הקמת עסק.
 *
 * שער תשלום (paywall): הגישה נגזרת מחדש בכל טעינה (getBusinessAccess).
 * כשאין גישה פעילה -> מסך חסימה במקום התוכן (חוסם פעולות ניהול).
 * בתקופת ניסיון -> באנר עליון עדין עם מספר הימים שנותרו.
 * עמוד ההזמנות הציבורי (/b/[slug]) אינו מושפע כלל.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect('/business/login?redirect=/admin');
  }

  // כתובת הבסיס /admin היא קונסולת הפלטפורמה של יניב: מנהל פלטפורמה מנותב
  // לניהול-העל (/superadmin) לפני בדיקת הבעלות, כדי שלא ייחסם לזרימת "הקמת עסק"
  // כשאינו בעלים של אף עסק. אין סכנת לולאת הפניה: /superadmin הוא עץ ניתוב נפרד
  // שאינו עטוף ב-layout זה ואינו מפנה בחזרה ל-/admin.
  if (isPlatformAdminEmail(email)) {
    redirect('/superadmin');
  }

  const owned = await getBusinessesOwnedByEmail(email);
  if (owned.length === 0) {
    redirect('/business/new');
  }

  const access = getBusinessAccess(owned[0]);

  // מנוי/ניסיון שפג -> חסימת אזור הניהול במסך paywall (יציאה נשארת נגישה).
  if (!access.active) {
    return <Paywall />;
  }

  // ספירת תורים הממתינים לאישור לחיווי (תג) על פריט "הזמנות" בסרגל הצד.
  const pendingCount = await countPendingAppointments(owned[0].id);

  // מרכז ההתראות בפעמון: תורים הממתינים לאישור וחידוש מנוי.
  const notifications = buildAdminNotifications({ pendingCount, access });

  return (
    <div dir="rtl" className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <AdminSidebar pendingCount={pendingCount} notifications={notifications} />
      <div
        className="min-w-0 flex-1"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {access.state === 'trialing' && <TrialBanner daysLeft={access.daysLeft} />}
        {children}
      </div>
    </div>
  );
}
