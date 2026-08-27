import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail, getBusinessById } from '@/server/repos/business';
import { countPendingAppointments, countRecentClientCancellations } from '@/server/repos/appointments';
import { getBusinessAccess } from '@/server/subscription';
import { isPlatformAdminEmail } from '@/server/platformAdmin';
import { getImpersonatedBusinessId } from '@/server/impersonation';
import AdminSidebar from './AdminSidebar';
import { buildAdminNotifications } from './notifications';
import Paywall from './Paywall';
import DeletionPending from './DeletionPending';
import TrialBanner from './TrialBanner';
import ImpersonationBanner from './ImpersonationBanner';

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

  // כתובת הבסיס /admin היא קונסולת הפלטפורמה של יניב. שני מסלולים למנהל-על:
  //  1) עם עוגיית התחזות תקפה (tc_imp) -> נכנס "כבעל העסק" המתוחזה ומדלג על שערי
  //     הבעלות והתשלום, כדי שיוכל להשלים הקמה, לתקן פרטים ולערוך תורים.
  //  2) ללא עוגייה -> מנותב לקונסולת ניהול-העל (/superadmin), כמו קודם.
  // getImpersonatedBusinessId() מאמת מחדש בכל בקשה שהצופה הוא מנהל פלטפורמה,
  // כך שהעוגייה לעולם אינה נסמכת לבדה. משתמש רגיל -> זרימת הבעלים הרגילה.
  const isPlatformAdmin = isPlatformAdminEmail(email);
  const impersonatedId = isPlatformAdmin ? await getImpersonatedBusinessId() : null;

  if (isPlatformAdmin && !impersonatedId) {
    redirect('/superadmin');
  }

  type AdminBusiness = Awaited<ReturnType<typeof getBusinessesOwnedByEmail>>[number];
  const impersonating = Boolean(impersonatedId);
  let business: AdminBusiness;

  if (impersonatedId) {
    const target = await getBusinessById(impersonatedId);
    if (!target) {
      // העסק לא נמצא (אולי נמחק) -> חזרה לקונסולה; נתיב היציאה ינקה את העוגייה.
      redirect('/superadmin');
    }
    business = target;
  } else {
    const owned = await getBusinessesOwnedByEmail(email);
    if (owned.length === 0) {
      redirect('/business/new');
    }
    business = owned[0];
  }

  // עסק שממתין למחיקה (PENDING_DELETION): אזור הניהול והעמוד הציבורי מושבתים.
  // במקום התוכן מציגים מסך שחזור בלבד (שחזור מנוי או התנתקות), כדי לאפשר לבטל את
  // המחיקה עד למועד המחיקה הסופית. הבעלים עדיין מזוהה כי השחזור מחייב זהות מאומתת.
  // בהתחזות מדלגים על מסך זה כדי לאפשר למנהל-על גישה מלאה לתיקון (החלטה A).
  if (!impersonating && business.accountStatus === 'PENDING_DELETION') {
    const purge = business.purgeScheduledFor;
    const purgeDateLabel = purge
      ? new Intl.DateTimeFormat('he-IL', {
          dateStyle: 'long',
          timeZone: 'Asia/Jerusalem',
        }).format(purge)
      : '';
    return (
      <DeletionPending
        businessName={business.name}
        purgeDateLabel={purgeDateLabel}
      />
    );
  }

  const access = getBusinessAccess(business);

  // מנוי/ניסיון שפג -> חסימת אזור הניהול במסך paywall (יציאה נשארת נגישה).
  // בהתחזות עוקפים את החסימה (החלטה A): גישה מלאה לתיקון עסקים שפג תוקפם.
  if (!impersonating && !access.active) {
    return <Paywall />;
  }

  // ספירת תורים הממתינים לאישור לחיווי (תג) על פריט "הזמנות" בסרגל הצד.
  const pendingCount = await countPendingAppointments(business.id);

  // ביטולי לקוח ב-24 השעות האחרונות לתורים עתידיים (משבצות שהתפנו) — להתראת הפעמון.
  const cancellationSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCancellations = await countRecentClientCancellations(
    business.id,
    cancellationSince,
  );

  // מרכז ההתראות בפעמון: תורים הממתינים לאישור, ביטולי לקוח וחידוש מנוי.
  const notifications = buildAdminNotifications({
    pendingCount,
    recentCancellations,
    access,
  });

  return (
    <div
      dir="rtl"
      className="flex min-h-screen flex-col md:flex-row"
      style={{ background: 'linear-gradient(180deg, #faf6ef 0%, #f5efe4 100%)' }}
    >
      <AdminSidebar pendingCount={pendingCount} notifications={notifications} />
      <div
        className="min-w-0 flex-1"
        style={{
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {impersonating && <ImpersonationBanner businessName={business.name} />}
        {access.state === 'trialing' && <TrialBanner daysLeft={access.daysLeft} />}
        {children}
      </div>
    </div>
  );
}
