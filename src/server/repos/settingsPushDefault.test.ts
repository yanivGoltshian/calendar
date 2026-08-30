import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * בדיקת רגרסיה לברירת המחדל של «התראות דחיפה למכשיר» (pushEnabled).
 *
 * המתג במסך ההגדרות נשען על ברירת המחדל של הסכימה: getOrCreateSettings יוצר
 * רשומת BusinessSettings עם `create: { businessId }` בלבד, כך שהעמודה pushEnabled
 * מקבלת את ערך ברירת המחדל של המסד. לכן ברירת המחדל חייבת להיות true כדי שהמתג
 * יוצג דלוק בעסק חדש ללא רשומת הגדרות.
 *
 * זו בדיקה טהורה על ארטיפקטים שנשמרים ב-repo (schema.prisma + המיגרציה), ללא תלות
 * ב-Postgres — מתאים לסביבה ללא מסד מקומי.
 */

const here = dirname(fileURLToPath(import.meta.url));
// קובץ זה: <repo>/src/server/repos/settingsPushDefault.test.ts ⇐ שלוש רמות אל שורש ה-repo
const repoRoot = resolve(here, '../../..');

const schema = readFileSync(resolve(repoRoot, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    repoRoot,
    'prisma/migrations/20260902000000_push_enabled_default_true/migration.sql',
  ),
  'utf8',
);

test('schema.prisma: pushEnabled מוגדר עם ברירת מחדל true', () => {
  assert.match(schema, /pushEnabled\s+Boolean\s+@default\(true\)/);
});

test('schema.prisma: אין יותר ברירת מחדל false ל-pushEnabled', () => {
  assert.doesNotMatch(schema, /pushEnabled\s+Boolean\s+@default\(false\)/);
});

test('migration: מעדכן את ברירת המחדל של העמודה ל-true', () => {
  assert.match(
    migration,
    /ALTER TABLE "BusinessSettings" ALTER COLUMN "pushEnabled" SET DEFAULT true/i,
  );
});

test('migration: ממלא (backfill) את הרשומות הקיימות ל-true', () => {
  assert.match(
    migration,
    /UPDATE "BusinessSettings" SET "pushEnabled" = true/i,
  );
});
