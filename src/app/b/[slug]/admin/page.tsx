import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getBusinessBySlug } from '@/server/repos/business';
import { isPlatformAdminEmail } from '@/server/platformAdmin';
import { decideBusinessAdminRoute, impersonateEntryHref } from '../adminAccess';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

/**
 * כניסה לאזור הניהול של העסק דרך כתובת העסק — /b/[slug]/admin.
 *
 * מטרה (כוונת המשתמש): בעל עסק מגיע להגדרות שלו פשוט על ידי הוספת /admin
 * לכתובת העסק הציבורית שלו. אין כאן ממשק ניהול נפרד אלא שער ניתוב דק שמפנה
 * לאזור הניהול הקנוני, כדי לא לשכפל את עץ /admin/*.
 *
 * הרשאות (נבדקות בצד השרת; הפונקציה decideBusinessAdminRoute טהורה וניתנת לבדיקה):
 * - עסק לא קיים            -> 404 (notFound).
 * - לא מחובר               -> מסך כניסת בעלים עם חזרה לאותה כתובת.
 * - הבעלים הרשום של ה-slug -> אזור הניהול הקנוני (/admin). עבור בעל עסק יחיד
 *                             owned[0] הוא בדיוק העסק הזה, כך ש"הוספת /admin
 *                             לכתובת העסק" מובילה להגדרות שלו.
 * - מנהל פלטפורמה שאינו הבעלים -> כניסת התחזות (/superadmin/impersonate/[id]): נכתבת
 *                             עוגייה חתומה והוא נכנס לאזור הניהול "כבעל העסק" של אותו slug.
 * - מחובר שאינו בעלים ואינו מנהל -> 404, כדי לא לדלוף קיום/פרטים של דיירים אחרים.
 */
export default async function BusinessAdminEntryPage({ params }: Props) {
  const { slug } = await params;

  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  let email: string | null = null;
  try {
    const session = await auth();
    email = session?.user?.email ?? null;
  } catch {
    email = null;
  }

  const route = decideBusinessAdminRoute({
    email,
    ownerEmail: business.ownerEmail,
    isPlatformAdmin: isPlatformAdminEmail(email),
  });

  if (route === 'login') {
    redirect(`/business/login?redirect=/b/${slug}/admin`);
  }
  if (route === 'owner') {
    redirect('/admin');
  }
  if (route === 'platform') {
    redirect(impersonateEntryHref(business.id));
  }

  notFound();
}
