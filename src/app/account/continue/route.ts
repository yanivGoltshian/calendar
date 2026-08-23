import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
import { findOrCreateUserByEmail } from '@/server/repos/otp';
import { setClientSession } from '@/lib/session';

/**
 * גשר זהות: הופך התחברות גוגל (NextAuth/JWT) לעוגיית לקוח חתומה (client_session).
 *
 * הרקע: יש שתי מערכות סשן נפרדות. התחברות גוגל מייצרת רק JWT של NextAuth, ולא
 * עוגיית לקוח שבה משתמש האזור האישי (/account). הראוט הזה נוחת מיד אחרי ה-callback
 * של גוגל (הוא ה-callbackUrl של כפתור הלקוח), קורא את זהות גוגל ומגשר אותה.
 *
 * זרימת הבעלים נשמרת בדיוק: אם המייל של גוגל מחזיק עסק, מפנים ל-/business/resume
 * (בדיוק כמו התחברות בעלים רגילה) בלי להגדיר עוגיית לקוח. רק מי שאינו בעל עסק
 * מקבל עוגיית לקוח ומופנה לעמוד האישי או ליעד שממנו הגיע.
 *
 * חובה שיהיה Route Handler (ולא עמוד): עוגיות ניתן לכתוב רק ב-Route Handler או
 * ב-Server Action. הנתיב נבחר מחוץ ל-/api כדי לא להיחתך על ידי ה-catch-all של NextAuth.
 */
export const dynamic = 'force-dynamic';

function safeNext(next: string | null): string {
  // מקבלים רק נתיב פנימי יחסי, כדי למנוע הפניה פתוחה (open redirect).
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/account';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    // התחברות גוגל לא הסתיימה בהצלחה: חוזרים לכניסת לקוחות.
    redirect('/login');
  }

  // שער הבעלים ללא שינוי: בעל עסק ממשיך לזרימת הבעלים הרגילה.
  const owned = await getBusinessesOwnedByEmail(email);
  if (owned.length > 0) {
    redirect('/business/resume');
  }

  // לקוח: מוצאים או יוצרים משתמש לפי המייל ומגדירים עוגיית לקוח חתומה ל-30 יום.
  const user = await findOrCreateUserByEmail(email, session?.user?.name ?? undefined);
  await setClientSession({
    userId: user.id,
    email: user.email ?? email,
    phone: user.phone ?? undefined,
    name: user.name ?? undefined,
  });

  redirect(next);
}
