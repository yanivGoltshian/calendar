import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// חוזה ברמת המקור: מוודא ששלושת העמודים הציבוריים אינם קוראים מידע אישי בשרת
// (אין דליפת PII לשלד הנשמר במטמון) ושהגדרת ה-route segment תואמת ליעד —
// דף הבית סטטי מלא (force-static), ועמודי העסק ISR (revalidate=600). קורא את
// קובצי המקור כטקסט מכיוון שייבוא מודול-העמוד חסום בבדיקות עקב שרשרת server-only.

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

// --- עמוד פרופיל העסק: ISR, ללא תורים אישיים בשרת ---

test('עמוד /b/[slug] מוגדר ISR revalidate=600 (ולא force-dynamic)', () => {
  assert.ok(profile.includes('export const revalidate = 600'), 'ציפינו ל-revalidate = 600');
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

// --- עמוד ההזמנה: ISR, ללא prefill אישי בשרת ---

test('עמוד /b/[slug]/book מוגדר ISR revalidate=600 (ולא force-dynamic)', () => {
  assert.ok(book.includes('export const revalidate = 600'), 'ציפינו ל-revalidate = 600');
  assert.ok(!book.includes('force-dynamic'), 'עמוד ההזמנה לא אמור להיות force-dynamic');
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
