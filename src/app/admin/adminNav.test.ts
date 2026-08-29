import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ADMIN_BOTTOM_NAV,
  ADMIN_MORE_ROWS,
  ADMIN_NAV_ITEMS,
  ADMIN_WHITELIST_PATHS,
  ADMIN_REMOVED_PATHS,
  isAdminNavActive,
} from './adminNav';

/**
 * טסטי נעילה לניווט האדמין המאוחד (באגים 1/2/3/4/5/7).
 * נועלים את ה-whitelist בן 13 הפריטים כמקור אמת יחיד, ואוסרים על זליגה
 * חוזרת של נתיבים שהוסרו לכל משטח ניווט. אלה טסטים טהורים (ללא DOM).
 */

const adminDir = dirname(fileURLToPath(import.meta.url));

// ── נעילה 1: בדיוק 13 פריטי ניווט, ואף אחד מהנתיבים שהוסרו לא מופיע ──
test('nav: בדיוק 13 פריטי ניווט מותרים (4 תחתון + 9 עוד)', () => {
  assert.equal(ADMIN_BOTTOM_NAV.length, 4);
  assert.equal(ADMIN_MORE_ROWS.length, 9);
  assert.equal(ADMIN_NAV_ITEMS.length, 13);
});

test('nav: כל פריט קישור מצביע על נתיב whitelist, אין נתיבים כפולים', () => {
  const paths = ADMIN_WHITELIST_PATHS;
  // 10 נתיבי קישור מובחנים (3 הנותרים הם bell/install/logout ללא נתיב)
  assert.equal(paths.length, 10);
  assert.equal(new Set(paths).size, paths.length, 'אין נתיבים כפולים');
  const expected = [
    '/admin',
    '/admin/appointments',
    '/admin/clients',
    '/admin/services',
    '/admin/team',
    '/admin/working-hours',
    '/admin/stats',
    '/admin/waitlist',
    '/admin/upgrade',
    '/admin/help',
  ];
  assert.deepEqual([...paths].sort(), [...expected].sort());
});

test('nav: אף נתיב שהוסר לא מופיע בשום משטח ניווט', () => {
  const removed = [
    '/admin/pos',
    '/admin/inventory',
    '/admin/documents',
    '/admin/marketing',
    '/admin/punch-cards',
    '/admin/onboarding',
    '/admin/settings',
  ];
  assert.deepEqual([...ADMIN_REMOVED_PATHS].sort(), [...removed].sort());
  for (const item of ADMIN_NAV_ITEMS) {
    if (!item.href) continue;
    assert.ok(
      !removed.includes(item.href),
      `נתיב שהוסר זלג חזרה לניווט: ${item.href}`,
    );
  }
});

// ── נעילה 2: שורת "התקנת האפליקציה" תמיד קיימת במודל הניווט ──
test('nav: שורת התקנת האפליקציה קיימת תמיד (action=install, ללא href)', () => {
  const install = ADMIN_MORE_ROWS.find((i) => i.action === 'install');
  assert.ok(install, 'חייבת להיות שורת התקנה בגיליון "עוד"');
  assert.equal(install?.href, undefined, 'שורת ההתקנה אינה נתיב ניווט');
  assert.equal(install?.label, 'התקנת האפליקציה');
});

// ── נעילה 3: "עזרה ותמיכה" מנווט לעמוד פנימי, ואין mailto חשוף בניווט ──
test('nav: עזרה ותמיכה מנווטת ל-/admin/help כעמוד פנימי', () => {
  const help = ADMIN_MORE_ROWS.find((i) => i.id === 'help');
  assert.ok(help);
  assert.equal(help?.action, 'link');
  assert.equal(help?.href, '/admin/help');
});

test('nav: אין mailto חשוף בשום פריט ניווט', () => {
  for (const item of ADMIN_NAV_ITEMS) {
    assert.ok(
      !(item.href ?? '').startsWith('mailto:'),
      `mailto חשוף בניווט: ${item.id}`,
    );
  }
});

test('nav: isAdminNavActive מבחין נכון בין הבית לנתיב מקונן', () => {
  assert.equal(isAdminNavActive('/admin', '/admin'), true);
  assert.equal(isAdminNavActive('/admin', '/admin/clients'), false);
  assert.equal(isAdminNavActive('/admin/clients', '/admin/clients'), true);
  assert.equal(isAdminNavActive('/admin/clients', '/admin/clients/42'), true);
  assert.equal(isAdminNavActive('/admin/stats', '/admin/waitlist'), false);
});

// ── smoke (באג 5): כל עמוד whitelist קיים ומרנדר תוכן אמיתי, לא גוף ריק ──
test('pages: כל 10 עמודי ה-whitelist קיימים, עם export default ותוכן ממשי', () => {
  for (const path of ADMIN_WHITELIST_PATHS) {
    const rel = path === '/admin' ? '' : path.replace('/admin/', '');
    const file = rel ? join(adminDir, rel, 'page.tsx') : join(adminDir, 'page.tsx');
    assert.ok(existsSync(file), `חסר קובץ עמוד: ${file}`);
    const src = readFileSync(file, 'utf8');
    assert.match(src, /export default/, `לעמוד ${path} אין export default`);
    assert.ok(src.length > 200, `עמוד ${path} נראה ריק/סטאב`);
    assert.match(src, /return\s*\(/, `עמוד ${path} לא מרנדר JSX`);
  }
});
