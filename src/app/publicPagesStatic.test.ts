import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEMO_BUSINESS_PATH, DEMO_BUSINESS_SLUG } from '@/config/brand';

// חוזה ברמת המקור: מוודא ששלושת העמודים הציבוריים אינם קוראים מידע אישי בשרת
// (אין דליפת PII לשלד הנשמר במטמון) ושהגדרת ה-route segment תואמת ליעד —
// דף הבית סטטי מלא (force-static), פרופיל העסק נשמר במטמון עם ISR של 300 שניות,
// ושלד ההזמנה סטטי ללא תפוגה (revalidate=false). dynamicParams מאפשר סלאגים חדשים.
// קורא את קובצי המקור כטקסט מכיוון
// שייבוא מודול-העמוד חסום בבדיקות עקב שרשרת server-only.

const APP_DIR = dirname(fileURLToPath(import.meta.url));

function read(...segments: string[]): string {
  return readFileSync(join(APP_DIR, ...segments), 'utf8');
}

const home = read('page.tsx');
const profile = read('b', '[slug]', 'page.tsx');
const book = read('b', '[slug]', 'book', 'page.tsx');
const rootLayout = read('layout.tsx');
const navbar = read('..', 'components', 'ui', 'Navbar.tsx');
const footer = read('..', 'components', 'ui', 'Footer.tsx');
const migrate = read('migrate', 'page.tsx');
const migrateSection = read('..', 'components', 'landing', 'MigrateSection.tsx');
const roadmap = read('roadmap', 'page.tsx');
const demo = read('demo', 'route.ts');

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

// --- מסלול ההדגמה השיווקי: פרימיום קנוני, סטטי וללא DB ---

test('עסק ההדגמה הקנוני הוא סקין ביוטי והנתיב נגזר ממנו', () => {
  assert.equal(DEMO_BUSINESS_SLUG, 'skin-beauty');
  assert.equal(DEMO_BUSINESS_PATH, '/b/skin-beauty');
});

test('דף הבית סטטי ואינו תלוי בעסק הראשון או במסד עבור קישורי ההדגמה', () => {
  assert.ok(home.includes("import { BRAND, DEMO_BUSINESS_PATH } from '@/config/brand'"));
  assert.ok(!home.includes('getFirstBusiness'));
  assert.ok(!home.includes('DATABASE_URL'));
  assert.ok(!home.includes("'/demo'"));
  assert.equal(
    home.match(/href=\{DEMO_BUSINESS_PATH\}/g)?.length,
    2,
    'שתי קריאות הפעולה בדף הבית חייבות להשתמש בנתיב ההדגמה המשותף',
  );
});

test('הניווט במחשב אינו מוסיף קישור הדגמה חדש', () => {
  assert.ok(
    !navbar.includes('{ href: DEMO_BUSINESS_PATH, label: t.marketing.nav.demo }'),
    'רשימת קישורי המקטעים שמוצגת במחשב חייבת לשמור על החשיפה הקודמת',
  );
});

test('קישור ההדגמה בתפריט הנייד ובכותרת התחתונה מגודר ב-showDemo', () => {
  assert.ok(navbar.includes('showDemo = false'));
  assert.ok(navbar.includes('showDemo && ('));
  assert.ok(navbar.includes('href={DEMO_BUSINESS_PATH}'));
  assert.ok(!navbar.includes("'/demo'") && !navbar.includes('"/demo"'));
  assert.ok(footer.includes('showDemo = false'));
  assert.ok(footer.includes('showDemo && ('));
  assert.ok(footer.includes('href={DEMO_BUSINESS_PATH}'));
  assert.ok(!footer.includes("'/demo'") && !footer.includes('"/demo"'));
});

test('כל נקודות הכניסה הציבוריות הנוספות משתמשות בנתיב המשותף וללא DB', () => {
  assert.ok(migrate.includes("export const dynamic = 'force-static'"));
  assert.ok(roadmap.includes("export const dynamic = 'force-static'"));
  assert.ok(!migrate.includes('getFirstBusiness'));
  assert.ok(!roadmap.includes('getFirstBusiness'));
  assert.ok(home.includes('<Navbar showDemo selfResolveAccount />'));
  assert.ok(home.includes('<Footer showDemo />'));
  assert.ok(migrate.includes('<Navbar showDemo absoluteLinks />'));
  assert.ok(migrate.includes('<Footer showDemo absoluteLinks />'));
  assert.ok(roadmap.includes('<Navbar showDemo absoluteLinks />'));
  assert.ok(roadmap.includes('<Footer showDemo absoluteLinks />'));
  assert.ok(migrateSection.includes('href={DEMO_BUSINESS_PATH}'));
  assert.ok(roadmap.includes('href={DEMO_BUSINESS_PATH}'));
});

test('/demo מפנה קבוע וישיר לעמוד ההדגמה הקנוני בלי מסך ביניים', () => {
  assert.ok(demo.includes("import { permanentRedirect } from 'next/navigation'"));
  assert.ok(demo.includes('permanentRedirect(DEMO_BUSINESS_PATH)'));
  assert.ok(!demo.includes('getExampleBusinesses'));
  assert.ok(demo.includes('export function GET(): never'));
});

test('אין קישור שיווקי לתצוגה הבסיסית או לבוחר ההדגמות הישן', () => {
  const marketingSources = [home, navbar, footer, migrate, migrateSection, roadmap, demo];
  for (const source of marketingSources) {
    assert.ok(!source.includes('/b/demo-barbershop'));
    assert.ok(!source.includes('href="/demo"'));
    assert.ok(!source.includes("href='/demo'"));
    assert.ok(!source.includes('תצוגה בסיסית'));
  }
});

// --- עמוד פרופיל העסק: ISR משותף, ללא תורים אישיים בשרת ---

test('business profiles retain shared five-minute ISR, static generation and dynamic paths', () => {
  assert.ok(
    /export\s+const\s+revalidate\s*=\s*300\s*;/.test(profile),
    'Shared cached pages must refresh eligibility after subscription expiry',
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
