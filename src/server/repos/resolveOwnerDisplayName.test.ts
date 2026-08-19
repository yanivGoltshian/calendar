import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveOwnerDisplayName } from './staff';

/**
 * בדיקות ל-resolveOwnerDisplayName — הליבה הטהורה שקובעת את שם התצוגה של איש הצוות
 * הדיפולטי שנזרע לבעלים ב-createBusiness ובריפוי־העצמי של /admin. הבאג המקורי: עסק
 * חדש נוצר ללא אף StaffMember, ולכן הבעלים נחת על יומן ריק בלי דרך לפעול. סדר הנפילה
 * לאחור: 1) שם מה-session, 2) שם משתמש קיים לפי המייל, 3) שם העסק, 4) החלק שלפני '@'.
 * כל מקור עובר trim ומדלגים על ריקים; הפונקציה לעולם לא מחזירה מחרוזת ריקה.
 * בדיקות טהורות ללא DB, בסגנון שאר בדיקות היחידה במאגר (node:test + assert/strict).
 */

test('resolveOwnerDisplayName: שם מה-session מנצח את כל השאר', () => {
  const name = resolveOwnerDisplayName({
    ownerName: 'יניב',
    ownerUserName: 'משתמש קיים',
    businessName: 'העסק',
    ownerEmail: 'owner@example.com',
  });
  assert.equal(name, 'יניב');
});

test('resolveOwnerDisplayName: נופל לשם המשתמש הקיים כשאין שם מה-session', () => {
  const name = resolveOwnerDisplayName({
    ownerName: null,
    ownerUserName: 'משתמש קיים',
    businessName: 'העסק',
    ownerEmail: 'owner@example.com',
  });
  assert.equal(name, 'משתמש קיים');
});

test('resolveOwnerDisplayName: נופל לשם העסק כשאין שם session ואין שם משתמש', () => {
  const name = resolveOwnerDisplayName({
    ownerName: null,
    ownerUserName: null,
    businessName: 'מספרת יניב',
    ownerEmail: 'owner@example.com',
  });
  assert.equal(name, 'מספרת יניב');
});

test('resolveOwnerDisplayName: נופל לחלק שלפני @ במייל כשכל השאר חסר', () => {
  const name = resolveOwnerDisplayName({
    ownerName: null,
    ownerUserName: null,
    businessName: null,
    ownerEmail: 'yaniv.golt@gmail.com',
  });
  assert.equal(name, 'yaniv.golt');
});

test('resolveOwnerDisplayName: מדלג על מקורות עם רווחים בלבד', () => {
  const name = resolveOwnerDisplayName({
    ownerName: '   ',
    ownerUserName: '\t\n',
    businessName: '  סלון יופי  ',
    ownerEmail: 'owner@example.com',
  });
  assert.equal(name, 'סלון יופי');
});

test('resolveOwnerDisplayName: מבצע trim לערך הנבחר', () => {
  const name = resolveOwnerDisplayName({
    ownerName: '  יניב גולטשיאן  ',
  });
  assert.equal(name, 'יניב גולטשיאן');
});

test('resolveOwnerDisplayName: מחזיר תמיד ערך לא־ריק גם כשכל הקלטים חסרים', () => {
  const name = resolveOwnerDisplayName({});
  assert.ok(name.length > 0, 'ציפינו לערך לא־ריק');
  assert.equal(name, name.trim(), 'ציפינו לערך ללא רווחים מובילים/נגררים');
});

test('resolveOwnerDisplayName: קלטים ריקים/רווחים בלבד לא שוברים ומחזירים ערך לא־ריק', () => {
  const name = resolveOwnerDisplayName({
    ownerName: '',
    ownerUserName: '   ',
    businessName: '',
    ownerEmail: '   ',
  });
  assert.ok(name.length > 0, 'ציפינו לערך לא־ריק גם כשכל המקורות ריקים או רווחים');
});
