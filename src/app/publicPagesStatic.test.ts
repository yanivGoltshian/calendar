import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// חוזה ברמת המקור: מוודא ששלושת העמודים הציבוריים אינם קוראים מידע אישי בשרת
// (אין דליפת PII לשלד הנשמר במטמון) ושהגדרת ה-route segment תואמת ליעד —
// דף הבית סטטי מלא (force-static) ועמודי העסק סטטיים מלאים (revalidate=false,
// dynamicParams=true, רענון על-פי דרישה בלבד). קורא את קובצי המקור כטקסט מכיוון
// שייבוא מודול-העמוד חסום בבדיקות עקב שרשרת server-only.

const APP_DIR = dirname(fileURLToPath(import.meta.url));

function read(...segments: string[]): string {
  return readFileSync(join(APP_DIR, ...segments), 'utf8');
}

const home = read('page.tsx');
const profile = read('b', '[slug]', 'page.tsx');
const book = read('b', '[slug]', 'book', 'page.tsx');
const rootLayout = read('layout.tsx');

// --- שלד השורש: אסור שיכפה דינמיות על כל האפליקציה ---

test('layout השורש אינו מגדיר force-dynamic (אחרת דף הבית לא ייבנה סטטי)', () => {
  assert.ok(
    !/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(rootLayout),
    "layout.tsx של השורש חייב להישאר ללא הכרזת export const dynamic = force-dynamic — " +
      'הדגל הגורף מדרדר לכל העמודים ומבטל את ה-force-static של דף הבית',
  );
});

// --- דף הבית: סטטי מלא, ללא מידע אישי בשרת ---

test('דף הבית מוגדר force-static (ולא ISR ולא דינמי)', () => {
  assert.ok(
    home.includes("export const dynamic = 'force-static'"),
    "ציפינו ל-export const dynamic = 'force-static' בדף הבית",
  );
  assert.ok(
    !home.includes('export const revalidate'),
    'דף הבית לא אמור להגדיר revalidate (הוא סטטי מלא)',
  );
  assert.ok(!home.includes('force-dynamic'), 'דף הבית לא אמור להיות force-dynamic');
});

test('דף הבית אינו קורא סשן/בעלים בשרת (זיהוי עבר להידרציה בצד הלקוח)', () => {
  assert.ok(!home.includes('getClientSession('), 'אין לקרוא getClientSession בשרת');
  assert.ok(
    !home.includes('getBusinessesOwnedByEmail('),
    'זיהוי הבעלים החוזר עבר ל-/api/public/owner-status (OwnerAwareCta)',
  );
  assert.ok(home.includes('OwnerAwareCta'), 'ציפינו לרכיב הלקוח OwnerAwareCta שמחליף את ה-CTA');
});

// --- עמוד פרופיל העסק: סטטי מלא, ללא תורים אישיים בשרת ---

test('עמוד /b/[slug] סטטי מלא: revalidate=false, dynamicParams, generateStaticParams (ולא force-dynamic ולא ISR מבוסס-זמן)', () => {
  assert.ok(
    /export\s+const\s+revalidate\s*=\s*false/.test(profile),
    'ציפינו ל-revalidate = false (מטמון עד רענון על-פי דרישה)',
  );
  assert.ok(
    !/export\s+const\s+revalidate\s*=\s*\d/.test(profile),
    'עמוד הפרופיל לא אמור להגדיר revalidate מספרי (ISR מבוסס-זמן)',
  );
  assert.ok(
    /export\s+const\s+dynamicParams\s*=\s*true/.test(profile),
    'ציפינו ל-dynamicParams = true כדי שסלאגים חדשים ייבנו בפנייה ראשונה',
  );
  assert.ok(
    profile.includes('generateStaticParams'),
    'ציפינו ל-generateStaticParams (טרום-רינדור סלאגים ידועים לזחלנים)',
  );
  assert.ok(!profile.includes('force-dynamic'), 'עמוד הפרופיל לא אמור להיות force-dynamic');
});

test('עמוד /b/[slug] אינו קורא סשן/תורים אישיים בשרת (עבר לרכיב לקוח)', () => {
  assert.ok(!profile.includes('getClientSession('), 'אין לקרוא getClientSession בשרת');
  assert.ok(
    !profile.includes('getUpcomingAppointmentsForUserAtBusiness('),
    'התורים של לקוח חוזר נטענים כעת ב-ReturningCustomerLoader (צד לקוח)',
  );
  assert.ok(
    profile.includes('ReturningCustomerLoader'),
    'ציפינו לרכיב הלקוח ReturningCustomerLoader',
  );
});

// --- עמוד ההזמנה: סטטי מלא, ללא prefill אישי ואישור מנוי בשרת ---

test('עמוד /b/[slug]/book סטטי מלא: revalidate=false, dynamicParams (ולא force-dynamic ולא ISR מבוסס-זמן)', () => {
  assert.ok(
    /export\s+const\s+revalidate\s*=\s*false/.test(book),
    'ציפינו ל-revalidate = false (מטמון עד רענון על-פי דרישה)',
  );
  assert.ok(
    !/export\s+const\s+revalidate\s*=\s*\d/.test(book),
    'עמוד ההזמנה לא אמור להגדיר revalidate מספרי (ISR מבוסס-זמן)',
  );
  assert.ok(
    /export\s+const\s+dynamicParams\s*=\s*true/.test(book),
    'ציפינו ל-dynamicParams = true כדי שסלאגים חדשים ייבנו בפנייה ראשונה',
  );
  assert.ok(!book.includes('force-dynamic'), 'עמוד ההזמנה לא אמור להיות force-dynamic');
});

test('עמוד /b/[slug]/book אינו בודק כשירות-מנוי בשרת (הבדיקה תלוית-הזמן עברה לצד הלקוח)', () => {
  assert.ok(
    !book.includes('canAcceptPublicBookings('),
    'בדיקת המנוי תלוית-הזמן חייבת לעבור ל-probe בצד הלקוח כדי שה-HTML הסטטי לא יכיל מידע תלוי-זמן',
  );
});

test('עמוד /b/[slug]/book אינו מזין prefill אישי בשרת (BookingStepper טוען בעצמו)', () => {
  assert.ok(!book.includes('getClientSession('), 'אין לקרוא getClientSession בשרת');
  assert.ok(
    !book.includes('customer='),
    'אין להעביר prop customer לשלד — פרטי הלקוח נטענים בצד הלקוח',
  );
  assert.ok(
    book.includes('waitlistEnabled'),
    'שער רשימת ההמתנה (#130) חייב להישאר כ-prop ברמת העסק בשלד',
  );
});
