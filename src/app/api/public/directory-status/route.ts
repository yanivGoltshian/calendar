import { NextResponse } from 'next/server';
import { countListedBusinesses } from '@/server/repos/business';
import { shouldShowDirectoryLink } from '@/lib/directory';

// שולף ספירת עסקים מה-DB בזמן בקשה, לכן חייב להישאר דינמי ולא נשמר במטמון.
export const dynamic = 'force-dynamic';

/**
 * נתיב קריאה-בלבד להזרמת מצב שער הספרייה בצד הלקוח (hydration) עבור שלד סטטי.
 * דף הבית והכותרות סטטיים ואינם יכולים לספור עסקים בזמן רינדור השרת, לכן ה-Navbar
 * וה-Footer שולפים כאן את המצב אחרי הטעינה ומציגים את הקישור ל-/businesses רק כש-≥3.
 * בטוח מפני כשל DB: כשל מחזיר count=0 ו-visible=false (fail-closed), ללא קריסה.
 */
export async function GET() {
  try {
    const count = await countListedBusinesses();
    const visible = shouldShowDirectoryLink(count);
    return NextResponse.json({ count, visible }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return NextResponse.json({ count: 0, visible: false }, { headers: { 'cache-control': 'no-store' } });
  }
}
