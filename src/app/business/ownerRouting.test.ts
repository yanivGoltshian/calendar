import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideNewBusinessView,
  ownerPrimaryHref,
  ownerPrimaryLabel,
  homeHeroCta,
  OWNER_ADMIN_HREF,
  NEW_BUSINESS_HREF,
  OWNER_LOGIN_HREF,
  ADDITIONAL_BUSINESS_HREF,
} from './ownerRouting';
import { t } from '@/i18n';

// --- decideNewBusinessView: הגנת /business/new לפי מצב הבעלים ---

test('אורח לא מחובר מקבל את מסך הכניסה (signin)', () => {
  assert.equal(decideNewBusinessView({ email: null, ownedCount: 0, another: false }), 'signin');
  assert.equal(
    decideNewBusinessView({ email: undefined, ownedCount: 3, another: true }),
    'signin',
  );
});

test('בעלים מחובר עם עסק קיים, בלי another, מופנה לאזור הניהול', () => {
  assert.equal(
    decideNewBusinessView({ email: 'owner@example.com', ownedCount: 1, another: false }),
    'redirect-admin',
  );
});

test('בעלים מחובר עם עסק קיים ו-another=1 מגיע למסך זהות אחרת, בלי לשכפל עסק', () => {
  assert.equal(
    decideNewBusinessView({ email: 'owner@example.com', ownedCount: 2, another: true }),
    'another-identity',
  );
});

test('מחובר בלי עסק כלל מקבל את טופס פתיחת העסק (create)', () => {
  assert.equal(
    decideNewBusinessView({ email: 'new@example.com', ownedCount: 0, another: false }),
    'create',
  );
  // גם כשמגיע עם another=1 אך אין לו עסק, ממשיכים להקמה רגילה.
  assert.equal(
    decideNewBusinessView({ email: 'new@example.com', ownedCount: 0, another: true }),
    'create',
  );
});

// --- ownerPrimaryHref / ownerPrimaryLabel: קריאות הפעולה בדף הבית ---

test('ה-href הראשי של בעלים חוזר הוא /admin, ושל אורח הוא /business/new', () => {
  assert.equal(ownerPrimaryHref(true), '/admin');
  assert.equal(ownerPrimaryHref(true), OWNER_ADMIN_HREF);
  assert.equal(ownerPrimaryHref(false), '/business/new');
  assert.equal(ownerPrimaryHref(false), NEW_BUSINESS_HREF);
});

test('התווית הראשית: בעלים חוזר רואה "לאזור הניהול שלי", אורח שומר את התווית המקורית', () => {
  assert.equal(ownerPrimaryLabel(true, 'התחילו עכשיו'), 'לאזור הניהול שלי');
  assert.equal(ownerPrimaryLabel(true, 'התחילו עכשיו'), t.marketing.hero.ownerCta);
  assert.equal(ownerPrimaryLabel(false, 'התחילו עכשיו'), 'התחילו עכשיו');
  assert.equal(ownerPrimaryLabel(false, 'מסלול בחינם'), 'מסלול בחינם');
});

// --- homeHeroCta: שורת ה-CTA של ה-hero מודעת להתחברות ---

test('בעלים חוזר: ראשי לאזור הניהול, משני פתיחת עסק נוסף בזהות אחרת', () => {
  const cta = homeHeroCta(true);
  assert.equal(cta.primaryHref, '/admin');
  assert.equal(cta.primaryLabel, 'לאזור הניהול שלי');
  assert.equal(cta.secondaryHref, '/business/new?another=1');
  assert.equal(cta.secondaryHref, ADDITIONAL_BUSINESS_HREF);
  assert.equal(cta.secondaryLabel, t.marketing.hero.ownerSecondaryCta);
});

test('אורח: ראשי התחילו עכשיו, ומשני כניסת בעלי עסקים לראוטר החכם /business/resume', () => {
  const cta = homeHeroCta(false);
  assert.equal(cta.primaryHref, '/business/new');
  assert.equal(cta.primaryLabel, t.marketing.hero.primaryCta);
  assert.equal(cta.secondaryHref, '/business/resume');
  assert.equal(cta.secondaryHref, OWNER_LOGIN_HREF);
  assert.equal(cta.secondaryLabel, 'כניסת בעלי עסקים');
  assert.equal(cta.secondaryLabel, t.marketing.nav.login);
});
