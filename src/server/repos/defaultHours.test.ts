import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defaultBusinessHours } from './workingHours';

/**
 * בדיקות ל-defaultBusinessHours — שעות ברירת המחדל שנזרעות לעסק חדש ב-createBusiness.
 * הבאג: עסק חדש נוצר ללא אף רשומת WorkingHours, ולכן מנוע הזמינות החזיר אפס משבצות
 * בכל יום, ולינק ההזמנה נשבר בשקט עד שהבעלים הגדיר שעות ידנית. ברירת המחדל הנזרעת:
 * ראשון–חמישי פתוחים 09:00–17:00 (540–1020), שישי ושבת סגורים (ללא רשומה).
 * בדיקות טהורות ללא DB, בסגנון שאר בדיקות היחידה במאגר (node:test + assert/strict).
 */

test('defaultBusinessHours: בדיוק 5 רשומות', () => {
  assert.equal(defaultBusinessHours().length, 5);
});

test('defaultBusinessHours: הימים הם בדיוק {0,1,2,3,4} (ראשון–חמישי)', () => {
  const weekdays = defaultBusinessHours()
    .map((r) => r.weekday)
    .sort((a, b) => a - b);
  assert.deepEqual(weekdays, [0, 1, 2, 3, 4]);
});

test('defaultBusinessHours: כל רשומה 09:00–17:00 (540–1020) ללא הפסקות', () => {
  for (const r of defaultBusinessHours()) {
    assert.equal(r.startMinute, 540);
    assert.equal(r.endMinute, 1020);
    assert.deepEqual(r.breaks, []);
  }
});

test('defaultBusinessHours: אין רשומה לשישי (5) או לשבת (6) — ימים סגורים', () => {
  const weekdays = new Set(defaultBusinessHours().map((r) => r.weekday));
  assert.ok(!weekdays.has(5), 'לא ציפינו לרשומה ליום שישי');
  assert.ok(!weekdays.has(6), 'לא ציפינו לרשומה ליום שבת');
});
