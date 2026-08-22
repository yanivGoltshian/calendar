import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * בדיקת רגרסיה לעמידוּת (durability) של קונפיגורציית Firebase הציבורית בתשתית.
 *
 * חמשת משתני `NEXT_PUBLIC_FIREBASE_*` (המפעילים כניסת טלפון בצד הלקוח) חייבים
 * להיות מחוברים כפרמטרים ראשונים־במעלה ב-bicep, כך שכל פריסת תשתית חוזרת תשמר
 * אותם ולא תמחק אותם. בעבר הם הוזרקו רק דרך `az containerapp update --set-env-vars`,
 * מה שהיה נמחק בפריסת bicep. הבדיקה קוראת את ה-ARM המהודר (`infra/main.json`)
 * ומוודאת שהחיווט קיים מקצה לקצה: הצהרת פרמטר עליון ⇐ העברה למודול ⇐ הרכבת ה-env.
 *
 * אין כאן תלות בפרודקשן: זו בדיקה טהורה על ארטיפקט התבנית שנשמר ב-repo.
 */

const here = dirname(fileURLToPath(import.meta.url));
// קובץ זה: <repo>/src/server/infra/firebasePublicEnv.test.ts ⇐ שלוש רמות אל שורש ה-repo
const repoRoot = resolve(here, '../../..');
const mainJsonPath = resolve(repoRoot, 'infra/main.json');
const raw = readFileSync(mainJsonPath, 'utf8');
const doc = JSON.parse(raw) as Record<string, unknown>;

const PUBLIC_ENV_NAMES = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
] as const;

const PARAM_NAMES = [
  'firebaseWebApiKey',
  'firebaseWebAuthDomain',
  'firebaseWebProjectId',
  'firebaseWebAppId',
  'firebaseWebMessagingSenderId',
] as const;

// איסוף רקורסיבי של כל הגדרות המשתנה `firebasePublicEnv` (התבנית מהודרת עם מודול מקונן).
function collectVarExpr(node: unknown, key: string, acc: string[]): string[] {
  if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    const v = rec[key];
    if (typeof v === 'string') acc.push(v);
    for (const child of Object.values(rec)) collectVarExpr(child, key, acc);
  }
  return acc;
}

test('infra: משתנה firebasePublicEnv מחווט את כל 5 משתני NEXT_PUBLIC_FIREBASE_* מפרמטרים', () => {
  const exprs = collectVarExpr(doc, 'firebasePublicEnv', []);
  assert.ok(exprs.length >= 1, 'משתנה firebasePublicEnv חייב להופיע ב-ARM המהודר');
  const expr = exprs[0];
  for (const name of PUBLIC_ENV_NAMES) {
    assert.ok(expr.includes(`'${name}'`), `חסר משתנה סביבה ${name}`);
  }
  for (const p of PARAM_NAMES) {
    assert.ok(expr.includes(`parameters('${p}')`), `הערך של ${p} אינו מחווט מפרמטר`);
  }
});

test('infra: קיים שומר firebaseWebConfigured, וה-env מרכיב את firebasePublicEnv', () => {
  const guards = collectVarExpr(doc, 'firebaseWebConfigured', []);
  assert.ok(guards.length >= 1, 'חייב להתקיים משתנה השומר firebaseWebConfigured');
  assert.ok(
    guards[0].includes("parameters('firebaseWebApiKey')") &&
      guards[0].includes("parameters('firebaseWebAppId')"),
    'השומר חייב להיבחן מול apiKey ו-appId',
  );
  assert.ok(
    raw.includes("variables('firebasePublicEnv')"),
    'רשימת ה-env של הקונטיינר חייבת לשרשר את firebasePublicEnv',
  );
});

test('infra: התבנית העליונה מצהירה ומעבירה למודול את כל 5 פרמטרי firebaseWeb', () => {
  const params = (doc.parameters ?? {}) as Record<string, unknown>;
  for (const p of PARAM_NAMES) {
    assert.ok(p in params, `פרמטר עליון חסר: ${p}`);
    assert.ok(
      raw.includes(`"value": "[parameters('${p}')]"`),
      `הפרמטר ${p} אינו מועבר למודול הקונטיינר`,
    );
  }
});
