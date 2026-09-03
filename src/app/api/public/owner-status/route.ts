import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';

// קורא את סשן ה-NextAuth (עוגייה) ולכן דינמי וללא מטמון. מחזיר דגל בוליאני
// לא-אישי בלבד (האם המבקר הוא בעל עסק חוזר), ללא כל פרט מזהה.
export const dynamic = 'force-dynamic';

/**
 * נתיב קריאה-בלבד לזיהוי "בעלים חוזר" בצד הלקוח. משמש את דף הבית ה-ISR כדי לנתב
 * בעל עסק מחובר אל /admin אחרי הטעינה, בלי לבסס את השלד הנשמר על זהות המבקר.
 */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  let isReturningOwner = false;
  if (email) {
    const owned = await getBusinessesOwnedByEmail(email);
    isReturningOwner = owned.length > 0;
  }
  return NextResponse.json({ isReturningOwner }, { headers: { 'cache-control': 'no-store' } });
}
