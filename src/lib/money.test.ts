import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shekelsToAgorot, agorotToShekels, formatAgorot } from './money';

/**
 * בדיקות לעוזרי הכסף — הכסף נשמר תמיד כאגורות (מספר שלם).
 * רלוונטי לתמחור שירותים (למשל מחיר של שירות 30 דק׳).
 */

test('shekelsToAgorot ממיר שקלים לאגורות עם עיגול', () => {
  assert.equal(shekelsToAgorot(120), 12000);
  assert.equal(shekelsToAgorot(0), 0);
  assert.equal(shekelsToAgorot(50.5), 5050);
  // עיגול לאגורה השלמה הקרובה.
  assert.equal(shekelsToAgorot(0.999), 100);
  // סכומים שליליים נשמרים.
  assert.equal(shekelsToAgorot(-5), -500);
});

test('agorotToShekels הוא ההופכי של shekelsToAgorot', () => {
  assert.equal(agorotToShekels(12000), 120);
  assert.equal(agorotToShekels(9999), 99.99);
  assert.equal(agorotToShekels(0), 0);
  // הלוך ושוב שומר על הערך.
  assert.equal(agorotToShekels(shekelsToAgorot(75.25)), 75.25);
});

test('formatAgorot מציג סכום בשקלים עם סימן ₪', () => {
  const formatted = formatAgorot(12000);
  assert.ok(formatted.includes('120'));
  assert.ok(formatted.includes('₪'));

  const zero = formatAgorot(0);
  assert.ok(zero.includes('0'));
  assert.ok(zero.includes('₪'));
});
