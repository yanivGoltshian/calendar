import assert from 'node:assert/strict';
import { test } from 'node:test';
import { t } from '@/i18n';

test('public booking receipt does not claim delivery and explains cancellation/rebooking', () => {
  assert.match(t.booking.bookingSuccessBody, /אין במסך זה אישור שנשלחה הודעה/);
  assert.match(t.booking.bookingSuccessBody, /לבטל ולקבוע תור חדש/);
  assert.match(t.booking.bookingSuccessBody, /בכפוף לזמינות ולמדיניות הביטול/);
});

test('pending and guest copy do not promise approval or automatic notifications', () => {
  for (const copy of [
    t.booking.pendingBody,
    t.booking.guestHint,
    t.booking.guestHintPremium,
    t.booking.bookingSuccessBodyNoComms,
  ]) {
    assert.doesNotMatch(copy, /נשלח אליכם|יישלח אליכם|נעדכן אתכם|יאשר את התור בקרוב/);
  }
});
