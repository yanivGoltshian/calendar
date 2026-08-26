import { test } from 'node:test';
import assert from 'node:assert/strict';

import { initialBookingStep, initialStaffId } from '@/lib/booking-prefill';

/**
 * בדיקות יחידה ללוגיקת מצב הפתיחה של זרימת ההזמנה מתוך קדם-בחירה (deep link),
 * כולל הקישור העמוק של "קביעת תור חוזר" שמסמן שירות ואיש צוות.
 */

test('בלי שירות מסומן מראש — מתחילים מבחירת השירות (שלב 0)', () => {
  assert.equal(
    initialBookingStep({ hasPreselectedService: false, hasPreselectedStaff: false, singleStaff: false }),
    0,
  );
  // גם אם הגיע ?staff בלי ?service תקין, אין קדם-בחירה ולכן מתחילים מ-0.
  assert.equal(
    initialBookingStep({ hasPreselectedService: false, hasPreselectedStaff: true, singleStaff: true }),
    0,
  );
});

test('שירות + איש צוות מסומנים מראש — קופצים ישר לבחירת מועד (שלב 2)', () => {
  assert.equal(
    initialBookingStep({ hasPreselectedService: true, hasPreselectedStaff: true, singleStaff: false }),
    2,
  );
});

test('שירות מסומן מראש עם נותן שירות יחיד — קופצים לבחירת מועד (שלב 2)', () => {
  assert.equal(
    initialBookingStep({ hasPreselectedService: true, hasPreselectedStaff: false, singleStaff: true }),
    2,
  );
});

test('שירות מסומן מראש בלי איש צוות ידוע (כמה) — שלב בחירת הצוות (שלב 1)', () => {
  assert.equal(
    initialBookingStep({ hasPreselectedService: true, hasPreselectedStaff: false, singleStaff: false }),
    1,
  );
});

test('initialStaffId מעדיף איש צוות תקין שנבחר מראש', () => {
  assert.equal(
    initialStaffId({
      preselectedStaffId: 'stf-9',
      isPreselectedStaffValid: true,
      singleStaff: false,
      firstStaffId: 'stf-1',
    }),
    'stf-9',
  );
});

test('initialStaffId נופל לנותן שירות יחיד כשאין בחירה מראש תקינה', () => {
  assert.equal(
    initialStaffId({
      preselectedStaffId: null,
      isPreselectedStaffValid: false,
      singleStaff: true,
      firstStaffId: 'stf-1',
    }),
    'stf-1',
  );
  // ?staff לא תקין (לא קיים ברשימה) → מתעלמים ממנו, נופלים ליחיד.
  assert.equal(
    initialStaffId({
      preselectedStaffId: 'ghost',
      isPreselectedStaffValid: false,
      singleStaff: true,
      firstStaffId: 'stf-1',
    }),
    'stf-1',
  );
});

test('initialStaffId מחזיר ריק כשאין בחירה מראש ואין נותן שירות יחיד', () => {
  assert.equal(
    initialStaffId({
      preselectedStaffId: null,
      isPreselectedStaffValid: false,
      singleStaff: false,
      firstStaffId: null,
    }),
    '',
  );
});
