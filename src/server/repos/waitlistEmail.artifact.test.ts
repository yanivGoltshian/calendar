import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * בדיקת רגרסיה על ארטיפקטים לשדה המייל האופציונלי ברשימת ההמתנה ולתנאי הזמינות החלקית.
 *
 * זו בדיקה טהורה על טקסט קבצים שנשמרים ב-repo (schema.prisma, המיגרציה, ה-repo וקומפוננטת
 * ה-Stepper), ללא תלות ב-Postgres או ב-React runtime — מתאים לסביבה ללא מסד. היא נועלת את
 * שתי ההחלטות המרכזיות של המשימה:
 *   שיפור ב' — עמודת email אופציונלית (nullable, תואם לאחור) והמיפוי שלה ב-addWaitlistEntry.
 *   שיפור א' — הצגת ה-CTA לרשימת המתנה גם בזמינות חלקית (variant="partial") לצד היום המלא
 *              (variant="full").
 */

const here = dirname(fileURLToPath(import.meta.url));
// קובץ זה: <repo>/src/server/repos/waitlistEmail.artifact.test.ts ⇐ שלוש רמות אל שורש ה-repo
const repoRoot = resolve(here, '../../..');

const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

// --- שיפור ב': סכימה + מיגרציה + מיפוי ב-repo ---

test('schema.prisma: WaitlistEntry כולל email אופציונלי (String?)', () => {
  const schema = read('prisma/schema.prisma');
  const model = schema.match(/model WaitlistEntry \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(model, /email\s+String\?/);
});

test('migration: מוסיפה עמודת email nullable (ללא NOT NULL, תואם לאחור)', () => {
  const migration = read(
    'prisma/migrations/20260903000000_add_waitlist_email/migration.sql',
  );
  assert.match(migration, /ALTER TABLE "WaitlistEntry" ADD COLUMN "email" TEXT/i);
  assert.doesNotMatch(migration, /NOT NULL/i);
});

test('repo addWaitlistEntry: ממפה email ל-create ומנרמל ריק ל-null', () => {
  const repoSrc = read('src/server/repos/waitlist.ts');
  assert.match(repoSrc, /email:\s*data\.email\?\.trim\(\)\s*\?\s*data\.email\.trim\(\)\s*:\s*null/);
});

test('repo notifyWaitlistEntry: בורר ערוץ ושולח מייל היידוע בענף email', () => {
  const repoSrc = read('src/server/repos/waitlist.ts');
  assert.match(repoSrc, /resolveWaitlistNotifyChannel/);
  assert.match(repoSrc, /buildWaitlistNotifyEmail/);
  assert.match(repoSrc, /sendReminderEmail/);
  // סימון NOTIFIED תמיד מתרחש (מחוץ לענפי הערוץ).
  assert.match(repoSrc, /status:\s*'NOTIFIED'/);
});

// --- שיפור א': ה-CTA מוצג גם בזמינות חלקית ---

test('BookingStepper: מציג CTA לרשימת המתנה גם ביום מלא וגם בזמינות חלקית', () => {
  const stepperSrc = read('src/app/b/[slug]/book/BookingStepper.tsx');
  assert.match(stepperSrc, /variant="full"/);
  assert.match(stepperSrc, /variant="partial"/);
});
