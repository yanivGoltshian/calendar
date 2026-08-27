import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isBusinessOwnerEmail,
  canAccessBusinessAdmin,
  decideBusinessAdminRoute,
  impersonateEntryHref,
  OWNER_ADMIN_HREF,
  PLATFORM_CONSOLE_HREF,
} from './adminAccess';

// --- isBusinessOwnerEmail: השוואת בעלות חסרת רגישות לאותיות/רווחים ---

test('בעלות: התאמה מדויקת של מייל הבעלים', () => {
  assert.equal(isBusinessOwnerEmail('owner@example.com', 'owner@example.com'), true);
});

test('בעלות: התאמה חסרת רגישות לאותיות גדולות/קטנות ולרווחים', () => {
  assert.equal(isBusinessOwnerEmail('Owner@Example.com', 'owner@example.com'), true);
  assert.equal(isBusinessOwnerEmail('  owner@example.com  ', 'owner@example.com'), true);
  assert.equal(isBusinessOwnerEmail('owner@example.com', '  OWNER@EXAMPLE.COM  '), true);
});

test('בעלות: מייל שונה אינו נחשב בעלים', () => {
  assert.equal(isBusinessOwnerEmail('someone@example.com', 'owner@example.com'), false);
});

test('בעלות: מייל ריק/null אינו נחשב בעלים', () => {
  assert.equal(isBusinessOwnerEmail(null, 'owner@example.com'), false);
  assert.equal(isBusinessOwnerEmail(undefined, 'owner@example.com'), false);
  assert.equal(isBusinessOwnerEmail('', 'owner@example.com'), false);
  assert.equal(isBusinessOwnerEmail('owner@example.com', null), false);
  assert.equal(isBusinessOwnerEmail('owner@example.com', undefined), false);
});

// --- canAccessBusinessAdmin: בעלים או מנהל פלטפורמה ---

test('גישה: הבעלים הרשום מורשה', () => {
  assert.equal(
    canAccessBusinessAdmin({
      email: 'owner@example.com',
      ownerEmail: 'owner@example.com',
      isPlatformAdmin: false,
    }),
    true,
  );
});

test('גישה: התאמת בעלים חסרת רגישות לאותיות מורשה', () => {
  assert.equal(
    canAccessBusinessAdmin({
      email: 'OWNER@example.com',
      ownerEmail: 'owner@EXAMPLE.com',
      isPlatformAdmin: false,
    }),
    true,
  );
});

test('גישה: מנהל פלטפורמה שאינו הבעלים מורשה', () => {
  assert.equal(
    canAccessBusinessAdmin({
      email: 'admin@platform.com',
      ownerEmail: 'owner@example.com',
      isPlatformAdmin: true,
    }),
    true,
  );
});

test('גישה: מחובר שאינו בעלים ואינו מנהל פלטפורמה — נדחה', () => {
  assert.equal(
    canAccessBusinessAdmin({
      email: 'stranger@example.com',
      ownerEmail: 'owner@example.com',
      isPlatformAdmin: false,
    }),
    false,
  );
});

test('גישה: מייל null/ריק ללא הרשאת פלטפורמה — נדחה', () => {
  assert.equal(
    canAccessBusinessAdmin({ email: null, ownerEmail: 'owner@example.com', isPlatformAdmin: false }),
    false,
  );
  assert.equal(
    canAccessBusinessAdmin({ email: '', ownerEmail: 'owner@example.com', isPlatformAdmin: false }),
    false,
  );
});

test('גישה: מנהל פלטפורמה מורשה גם כשמייל הבעלים חסר', () => {
  assert.equal(
    canAccessBusinessAdmin({ email: 'admin@platform.com', ownerEmail: null, isPlatformAdmin: true }),
    true,
  );
});

// --- decideBusinessAdminRoute: יעד הניתוב של /b/[slug]/admin ---

test('ניתוב: לא מחובר -> מסך כניסה', () => {
  assert.equal(
    decideBusinessAdminRoute({ email: null, ownerEmail: 'owner@example.com', isPlatformAdmin: false }),
    'login',
  );
  assert.equal(
    decideBusinessAdminRoute({ email: '', ownerEmail: 'owner@example.com', isPlatformAdmin: true }),
    'login',
  );
});

test('ניתוב: הבעלים הרשום -> אזור הניהול (/admin)', () => {
  assert.equal(
    decideBusinessAdminRoute({
      email: 'owner@example.com',
      ownerEmail: 'owner@example.com',
      isPlatformAdmin: false,
    }),
    'owner',
  );
  assert.equal(OWNER_ADMIN_HREF, '/admin');
});

test('ניתוב: בעלות קודמת להרשאת פלטפורמה — בעל עסק שהוא גם מנהל, בכתובת העסק שלו, מנותב ל-owner', () => {
  assert.equal(
    decideBusinessAdminRoute({
      email: 'owner@example.com',
      ownerEmail: 'owner@example.com',
      isPlatformAdmin: true,
    }),
    'owner',
  );
});

test('ניתוב: מנהל פלטפורמה שאינו הבעלים -> ענף platform (כניסת התחזות, לא מבוי סתום)', () => {
  const input = {
    email: 'admin@platform.com',
    ownerEmail: 'owner@example.com',
    isPlatformAdmin: true,
  };
  // ההחלטה הטהורה נשארת 'platform'...
  assert.equal(decideBusinessAdminRoute(input), 'platform');
  // ...אך היעד בפועל הוא כעת כניסת ההתחזות לעסק, ולא מבוי סתום ל-/superadmin.
  const dest = impersonateEntryHref('biz_123');
  assert.equal(dest, '/superadmin/impersonate/biz_123');
  assert.notEqual(dest, PLATFORM_CONSOLE_HREF);
});

// --- impersonateEntryHref: נתיב כניסת ההתחזות (טהור) ---

test('התחזות: הנתיב מורכב מזהה העסק', () => {
  assert.equal(impersonateEntryHref('abc'), '/superadmin/impersonate/abc');
  assert.equal(impersonateEntryHref('biz_42'), '/superadmin/impersonate/biz_42');
});

test('ניתוב: מחובר שאינו בעלים ואינו מנהל -> 404 (forbidden)', () => {
  assert.equal(
    decideBusinessAdminRoute({
      email: 'stranger@example.com',
      ownerEmail: 'owner@example.com',
      isPlatformAdmin: false,
    }),
    'forbidden',
  );
});
