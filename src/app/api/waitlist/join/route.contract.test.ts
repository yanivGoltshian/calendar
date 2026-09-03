import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * מבחני חוזה עבור מסלול ההצטרפות לרשימת המתנה POST `src/app/api/waitlist/join/route.ts`.
 *
 * למה מבחן חוזה ולא ייבוא ישיר של ה-handler:
 * ה-handler הוא server-only — הוא קורא ל-Prisma ולשער המנוי, ו-`bodySchema` שלו אינו
 * מיוצא (אילוץ additive-only על פנימיות המסלול, מתועד ב-route.contract של ההזמנה). לכן
 * קובץ זה נועל את חוזה גוף הבקשה כמראה מדויק של `bodySchema` (route.ts:21-35) ומאמת
 * שהתוספת של שדה המייל האופציונלי אכן קיימת גם בקוד המקור.
 *
 * יש לשמור את המראה מסונכרן עם bodySchema במסלול.
 */

// --- מראה של bodySchema (route.ts:21-35) ---
const waitlistJoinContract = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().email().optional(),
  serviceId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  desiredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'desiredDate must be YYYY-MM-DD')
    .optional(),
  earliestMinute: z.number().int().min(0).max(1439).optional(),
  latestMinute: z.number().int().min(0).max(1439).optional(),
  note: z.string().trim().max(500).optional(),
});

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'demo-salon',
    name: 'דנה',
    phone: '0501234567',
    ...overrides,
  };
}

test('חוזה: שם + טלפון בלבד עוברים (מייל אופציונלי)', () => {
  const result = waitlistJoinContract.safeParse(validBody());
  assert.equal(result.success, true);
});

test('חוזה: גוף תקין עם מייל תקין עובר', () => {
  const result = waitlistJoinContract.safeParse(validBody({ email: 'dana@example.com' }));
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.email, 'dana@example.com');
});

test('חוזה: מייל עובר trim לפני ולידציה', () => {
  const result = waitlistJoinContract.safeParse(validBody({ email: '  dana@example.com  ' }));
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.email, 'dana@example.com');
});

test('חוזה: מייל לא-תקין נדחה', () => {
  assert.equal(waitlistJoinContract.safeParse(validBody({ email: 'not-an-email' })).success, false);
  assert.equal(waitlistJoinContract.safeParse(validBody({ email: 'dana@' })).success, false);
});

test('חוזה: שם וטלפון נותרו חובה גם עם התוספת', () => {
  const noName = validBody();
  delete (noName as Record<string, unknown>).name;
  assert.equal(waitlistJoinContract.safeParse(noName).success, false);

  const noPhone = validBody();
  delete (noPhone as Record<string, unknown>).phone;
  assert.equal(waitlistJoinContract.safeParse(noPhone).success, false);
});

// --- אימות קוד המקור: השדה נוסף לסכימה ומועבר ל-repo ---
const here = dirname(fileURLToPath(import.meta.url));
// קובץ זה: <repo>/src/app/api/waitlist/join/route.contract.test.ts ⇐ חמש רמות אל שורש ה-repo
const repoRoot = resolve(here, '../../../../..');
const routeSrc = readFileSync(
  resolve(repoRoot, 'src/app/api/waitlist/join/route.ts'),
  'utf8',
);

test('קוד המסלול: הסכימה כוללת email אופציונלי עם ולידציית מייל', () => {
  assert.match(routeSrc, /email:\s*z\.string\(\)\.trim\(\)\.email\(\)\.optional\(\)/);
});

test('קוד המסלול: המייל מועבר ל-addWaitlistEntry', () => {
  assert.match(routeSrc, /email:\s*parsed\.email\s*\?\?\s*null/);
});
