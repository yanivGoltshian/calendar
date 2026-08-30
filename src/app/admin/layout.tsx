import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail, getBusinessById, getActiveBusiness } from '@/server/repos/business';
import { countPendingAppointments, countRecentClientCancellations, countRecentBookings } from '@/server/repos/appointments';
import { getOrCreateSettings } from '@/server/repos/settings';
import { resolveOwnerDisplayName } from '@/server/repos/staff';
import { getBusinessAccess } from '@/server/subscription';
import { isPlatformAdminEmail } from '@/server/platformAdmin';
import { getImpersonatedBusinessId } from '@/server/impersonation';
import AdminChrome from './home/AdminChrome';
import { buildAdminNotifications } from './notifications';
import Paywall from './Paywall';
import DeletionPending from './DeletionPending';
import TrialBanner from './TrialBanner';
import ImpersonationBanner from './ImpersonationBanner';

export const dynamic = 'force-dynamic';

/**
 * מטא-דאטה לאזור הניהול (מותאם-הקשר): דורסת את המניפסט הגלובלי עבור /admin/*
 * ומצביעה על מניפסט ה-PWA של הניהול. הדפדפן מושך את המניפסט ללא עוגיות ולכן
 * אינו יכול לזהות את העסק מתוך ה-route עצמו; לפיכך מזהים כאן את העסק הפעיל
 * (מודע-התחזות) דרך getActiveBusiness ומעבירים את ה-slug בתוך כתובת המניפסט,
 * בדיוק כמו הקשר עמוד ההזמנות. כך ההתקנה מהאדמין ממותגת-עסק (שם העסק והלוגו
 * שלו). ללא עסק/slug — נפילה חיננית למניפסט הפלטפורמה הגנרי ללא פרמטר.
 */
export async function generateMetadata(): Promise<Metadata> {
  const business = await getActiveBusiness();
  const slug = business?.slug;
  const manifest = slug
    ? `/admin/manifest.webmanifest?slug=${encodeURIComponent(slug)}`
    : '/admin/manifest.webmanifest';
  return {
    applicationName: 'תור צ׳יק · ניהול',
    manifest,
    appleWebApp: {
      capable: true,
      title: business?.name ?? 'תור צ׳יק ניהול',
      statusBarStyle: 'default',
    },
  };
}

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

  // הגדרות ההתראות של העסק — שולטות אילו פריטים מוצגים בפעמון. ברירת המחדל של
  // notifyOnBooking/notifyOnCancellation היא true, ולכן היעדר הגדרה שקול להתנהגות
  // הקיימת. בעל עסק שיכבה מתג, הפריט המתאים לא ייספר ולא יופיע בפעמון.
  const ownerSettings = await getOrCreateSettings(business.id);
  const notifyOnBooking = ownerSettings.notifyOnBooking ?? true;
  const notifyOnCancellation = ownerSettings.notifyOnCancellation ?? true;

  const rollingSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // הזמנות מאושרות ב-24 השעות האחרונות (כולל אישור אוטומטי) — להתראת הפעמון.
  const recentBookings = notifyOnBooking
    ? await countRecentBookings(business.id, rollingSince)
    : 0;

  // ביטולי לקוח ב-24 השעות האחרונות לתורים עתידיים (משבצות שהתפנו) — להתראת הפעמון.
  const recentCancellations = notifyOnCancellation
    ? await countRecentClientCancellations(business.id, rollingSince)
    : 0;

  // מרכז ההתראות בפעמון: תורים הממתינים לאישור, הזמנות חדשות, ביטולי לקוח וחידוש מנוי.
  const notifications = buildAdminNotifications({
    pendingCount,
    recentBookings,
    recentCancellations,
    access,
  });

  // ── כותרת משותפת: לוגו, שם העסק וברכה אישית (שם הבעלים + תאריך עברי) ──────────
  // נגזרות פעם אחת ב-layout כדי שהסרגל העליון יהיה זהה בין הבית לעמודים הפנימיים.
  const ownerDisplayName = resolveOwnerDisplayName({
    ownerName: session?.user?.name ?? null,
    businessName: business.name,
    ownerEmail: business.ownerEmail,
  });
  const greetingDate = new Intl.DateTimeFormat('he-IL', {
    timeZone: business.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const greeting = `שלום ${ownerDisplayName} · ${greetingDate}`;
  const logoLetter = business.name.trim().charAt(0) || 'ת';

  return (
    <AdminChrome
      logoLetter={logoLetter}
      bizName={business.name}
      greeting={greeting}
      notifications={notifications}
    >
      {impersonating && <ImpersonationBanner businessName={business.name} />}
      {access.state === 'trialing' && <TrialBanner daysLeft={access.daysLeft} />}
      {children}
    </AdminChrome>
  );
}
