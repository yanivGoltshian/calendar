import { NextResponse } from 'next/server';
import { getClientSession } from '@/lib/session';

// קורא את עוגיית ה-client_session ולכן חייב להישאר דינמי ולא נשמר במטמון.
export const dynamic = 'force-dynamic';

/**
 * נתיב קריאה-בלבד להזרמת זהות הלקוח המחובר בצד הלקוח (hydration), אחרי שהשלד
 * הסטטי (ISR) נטען. מחזיר אך ורק את נתוני המבקש עצמו, ללא מטמון, כדי שלא ידלוף
 * מידע אישי ל-HTML המשותף הנשמר. מיפוי null → אורח/ת.
 */
export async function GET() {
  const session = await getClientSession();
  const customer = session
    ? {
        name: session.name ?? '',
        phone: session.phone ?? '',
        email: session.email ?? '',
      }
    : null;
  return NextResponse.json({ customer }, { headers: { 'cache-control': 'no-store' } });
}
