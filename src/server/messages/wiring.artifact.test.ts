import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * בדיקת רגרסיה על ארטיפקטים: מוודאת שכל בנאי הודעה ללקוח-קצה עבר לחווט דרך
 * renderMessage עם המפתח הנכון. זו בדיקה טהורה על טקסט הקבצים שנשמרים ב-repo,
 * ללא תלות ב-Postgres או ב-runtime — נועלת שהחיווט קיים ולא ייסוג בטעות.
 *
 * תאימות-לאחור עצמה מובטחת ב-render.test.ts (fallback verbatim); כאן רק מאמתים
 * שכל אתר שליחה אכן קורא ל-renderMessage עם ה-fallback של הבנאי הקיים.
 */

const here = dirname(fileURLToPath(import.meta.url));
// קובץ זה: <repo>/src/server/messages/wiring.artifact.test.ts ⇐ שלוש רמות אל השורש
const repoRoot = resolve(here, '../../..');
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

const WIRED: Array<{ file: string; key: string }> = [
  { file: 'src/server/providers/email.ts', key: 'otp_login' },
  { file: 'src/server/notifications/bookingConfirmation.ts', key: 'booking_confirmation' },
  { file: 'src/server/notifications/clientApproval.ts', key: 'booking_approval' },
  { file: 'src/server/reminders/send.ts', key: 'reminder' },
  { file: 'src/server/repos/waitlist.ts', key: 'waitlist_freed' },
];

for (const { file, key } of WIRED) {
  test(`${file}: מייבא וקורא renderMessage עם המפתח '${key}'`, () => {
    const src = read(file);
    assert.match(src, /import \{[\s\S]*renderMessage[\s\S]*\} from '@\/server\/messages\/render'/);
    assert.match(src, /await renderMessage\(/);
    assert.ok(src.includes(`'${key}'`), `expected key literal '${key}' in ${file}`);
  });
}

test('registry: MessageTemplate model קיים בסכימה + מיגרציה תואמת-לאחור', () => {
  const schema = read('prisma/schema.prisma');
  const model = schema.match(/model MessageTemplate \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(model, /subject\s+String\?/);
  assert.match(model, /body\s+String/);
  assert.match(model, /@@unique\(\[businessId, key, channel\]\)/);

  const migration = read(
    'prisma/migrations/20260904000000_add_message_templates/migration.sql',
  );
  assert.match(migration, /CREATE TABLE "MessageTemplate"/i);
  assert.match(migration, /CREATE UNIQUE INDEX/i);
});
