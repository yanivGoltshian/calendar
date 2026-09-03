import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowWaitlistGoogle, waitlistGoogleCallbackUrl } from './waitlistGoogle';

/**
 * בדיקות טהורות ללוגיקת כפתור גוגל בטופס רשימת ההמתנה. הכפתור מוצג אך ורק כאשר
 * הלקוח אינו מחובר וההתחברות עם גוגל מופעלת בעסק.
 */

test('shouldShowWaitlistGoogle: מוצג רק כשלא מחובר וגוגל מופעל', () => {
  assert.equal(shouldShowWaitlistGoogle(false, true), true);
});

test('shouldShowWaitlistGoogle: מוסתר כשהלקוח מחובר', () => {
  assert.equal(shouldShowWaitlistGoogle(true, true), false);
});

test('shouldShowWaitlistGoogle: מוסתר כשגוגל כבוי', () => {
  assert.equal(shouldShowWaitlistGoogle(false, false), false);
  assert.equal(shouldShowWaitlistGoogle(true, false), false);
});

test('shouldShowWaitlistGoogle: undefined נחשב כלא-מחובר/כבוי', () => {
  // authed=undefined + googleEnabled=true → מוצג (אורח).
  assert.equal(shouldShowWaitlistGoogle(undefined, true), true);
  // googleEnabled=undefined → מוסתר (אין ערוץ להציע).
  assert.equal(shouldShowWaitlistGoogle(false, undefined), false);
  assert.equal(shouldShowWaitlistGoogle(undefined, undefined), false);
});

test('waitlistGoogleCallbackUrl: מפנה דרך גשר הזהות חזרה לעמוד ההזמנה', () => {
  assert.equal(
    waitlistGoogleCallbackUrl('acme'),
    '/account/continue?next=%2Fb%2Facme%2Fbook',
  );
});
