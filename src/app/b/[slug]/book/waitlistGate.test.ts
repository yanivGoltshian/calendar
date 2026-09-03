import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowWaitlist } from './waitlistGate';

/**
 * בדיקות טהורות לגייטינג רשימת ההמתנה בעמוד ההזמנה. האזור מוצג כשהדגל מופעל,
 * מוסתר כשהוא כבוי במפורש, ומוצג כברירת מחדל (תאימות-לאחור) כשהערך אינו מוגדר.
 */

test('shouldShowWaitlist: מוצג כשהדגל מופעל', () => {
  assert.equal(shouldShowWaitlist(true), true);
});

test('shouldShowWaitlist: מוסתר כשהדגל כבוי במפורש', () => {
  assert.equal(shouldShowWaitlist(false), false);
});

test('shouldShowWaitlist: undefined נחשב כמופעל (תאימות-לאחור)', () => {
  assert.equal(shouldShowWaitlist(undefined), true);
});
