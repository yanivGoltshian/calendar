import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BRAND } from '@/config/brand';
import { formatDateString, formatLongDate, formatTime } from '@/lib/time';
import { absoluteUrl } from '@/lib/seo';
import {
  buildConfirmationEmail,
  buildConfirmationMessage,
  type BookingConfirmationPayload,
} from '@/server/notifications/bookingConfirmation';
import {
  buildApprovalEmail,
  buildApprovalMessage,
  type ClientApprovalPayload,
} from '@/server/notifications/clientApproval';
import {
  buildReminderBody,
  buildReminderEmail,
  type ReminderAppointment,
} from '@/server/reminders/send';
import { buildWaitlistNotifyEmail } from '@/server/repos/waitlistNotify';
import { buildOtpMessage } from '@/server/providers/messaging';

import { getChannelDefault, type MessageKey, type MessageChannel } from './registry';
import { substitute } from './render';

/**
 * שער תאימות-לאחור: ברירות-המחדל במרשם חייבות להיות זהות בייט-בבייט לפלט הבנאים
 * הקיימים, לכל מפתח × ערוץ. אם ברירת-מחדל תסטה מהבנאי, בדיקה זו תיפול — כך אנו
 * מבטיחים שכאשר אין דריסת-בעלים ההתנהגות נשארת ללא שינוי.
 */

const TZ = 'Asia/Jerusalem';
const START = new Date('2026-08-25T09:30:00.000Z');
const MANAGE_URL = 'http://localhost:3000/b/demo';

/** מחזיר את גוף ברירת-המחדל (או נכשל אם הערוץ אינו מוגדר). */
function body(key: MessageKey, channel: MessageChannel): string {
  const def = getChannelDefault(key, channel);
  assert.ok(def, `expected default for ${key}.${channel}`);
  return def.body;
}

function subject(key: MessageKey, channel: MessageChannel): string {
  const def = getChannelDefault(key, channel);
  assert.ok(def?.subject, `expected subject for ${key}.${channel}`);
  return def.subject as string;
}

test('booking_confirmation: ברירות-המחדל זהות לבנאי (שירותים + קישור נוכחים)', () => {
  const payload: BookingConfirmationPayload = {
    appointmentId: 'a1',
    businessName: 'מספרת הדגמה',
    clientName: 'דנה כהן',
    services: [{ name: 'תספורת' }, { name: 'צבע' }],
    startAt: START,
    timezone: TZ,
    canEmail: true,
    canWhatsapp: true,
    manageUrl: MANAGE_URL,
    businessPhone: '050-0000000',
    businessAddress: 'רחוב הדגמה 1, תל אביב',
  };
  const dateStr = formatDateString(payload.startAt, TZ);
  const vars = {
    clientName: payload.clientName,
    businessName: payload.businessName,
    services: payload.services.map((s) => s.name).join(', '),
    date: formatLongDate(dateStr, TZ),
    time: formatTime(payload.startAt, TZ),
    manageUrl: MANAGE_URL,
    businessPhone: '050-0000000',
    businessAddress: 'רחוב הדגמה 1, תל אביב',
    brand: BRAND.name,
  };

  const email = buildConfirmationEmail(payload);
  assert.equal(substitute(body('booking_confirmation', 'email'), vars), email.text);
  assert.equal(substitute(subject('booking_confirmation', 'email'), vars), email.subject);
  assert.equal(
    substitute(body('booking_confirmation', 'sms'), vars),
    buildConfirmationMessage(payload),
  );
});

test('booking_approval: ברירות-המחדל זהות לבנאי (ללא שירותים + קישור נוכח)', () => {
  const payload: ClientApprovalPayload = {
    appointmentId: 'a1',
    businessId: 'biz-1',
    businessName: 'מספרת הדגמה',
    clientName: 'דנה כהן',
    services: [],
    startAt: START,
    timezone: TZ,
    canEmail: true,
    isExclusive: true,
    manageUrl: MANAGE_URL,
    businessPhone: '050-0000000',
    businessAddress: 'רחוב הדגמה 1, תל אביב',
  };
  const dateStr = formatDateString(payload.startAt, TZ);
  const vars = {
    clientName: payload.clientName,
    businessName: payload.businessName,
    date: formatLongDate(dateStr, TZ),
    time: formatTime(payload.startAt, TZ),
    manageUrl: MANAGE_URL,
    businessPhone: '050-0000000',
    businessAddress: 'רחוב הדגמה 1, תל אביב',
    brand: BRAND.name,
  };

  const email = buildApprovalEmail(payload);
  assert.equal(substitute(body('booking_approval', 'email'), vars), email.text);
  assert.equal(substitute(subject('booking_approval', 'email'), vars), email.subject);
  assert.equal(
    substitute(body('booking_approval', 'sms'), vars),
    buildApprovalMessage(payload),
  );
});

test('reminder: ברירות-המחדל זהות לבנאי (ללקוח ללא שם, אישור הגעה דלוק)', () => {
  const appt: ReminderAppointment = {
    id: 'a1',
    startAt: START,
    confirmToken: 'tok-123',
    business: {
      id: 'biz-1',
      name: 'מספרת הדגמה',
      timezone: TZ,
      isExclusive: false,
      settings: { reminderChannel: 'AUTO', confirmationRequired: true },
    },
    client: { id: 'c1', name: '', phone: '050-1234567', email: null },
  };
  const dateStr = formatDateString(appt.startAt, TZ);
  const vars = {
    businessName: appt.business.name,
    date: formatLongDate(dateStr, TZ),
    time: formatTime(appt.startAt, TZ),
    manageUrl: absoluteUrl(`/c/${appt.confirmToken}`),
    brand: BRAND.name,
  };

  const email = buildReminderEmail(appt);
  assert.equal(substitute(body('reminder', 'email'), vars), email.text);
  assert.equal(substitute(subject('reminder', 'email'), vars), email.subject);
  // גוף המסרון זהה לגוף המייל (buildReminderBody).
  assert.equal(substitute(body('reminder', 'sms'), vars), buildReminderBody(appt));
});

test('waitlist_freed: ברירות-המחדל זהות לבנאי המייל וללוגיקת ה-SMS', () => {
  const clientName = 'דנה כהן';
  const vars = { clientName, businessName: 'מספרת הדגמה', brand: BRAND.name };

  const email = buildWaitlistNotifyEmail(clientName);
  assert.equal(substitute(body('waitlist_freed', 'email'), vars), email.text);
  assert.equal(substitute(subject('waitlist_freed', 'email'), vars), email.subject);

  // ה-SMS מוגדר inline ב-notifyWaitlistEntry; משווים למחרוזת המקורית המדויקת.
  const smsExpected = `${BRAND.name}: התפנה תור! ${clientName}, נשמח לשמור לך מועד. השיבו להודעה זו לתיאום.`;
  assert.equal(substitute(body('waitlist_freed', 'sms'), vars), smsExpected);
});

test('otp_login: ברירות-המחדל זהות לנוסח ה-OTP הקיים (מייל ו-SMS)', () => {
  const code = '123456';
  const vars = { code, brand: BRAND.name };

  // מייל: buildOtpMessage ב-email.ts אינו מיוצא — משווים למחרוזות המקוריות המדויקות.
  const emailSubjectExpected = `${BRAND.name} · קוד האימות שלך`;
  const emailBodyExpected = `קוד האימות שלך אל ${BRAND.name} הוא ${code}. הקוד תקף ל-5 דקות. אם לא ביקשת קוד, אפשר להתעלם מהודעה זו.`;
  assert.equal(substitute(subject('otp_login', 'email'), vars), emailSubjectExpected);
  assert.equal(substitute(body('otp_login', 'email'), vars), emailBodyExpected);

  // SMS: buildOtpMessage מיוצא מ-messaging.ts.
  assert.equal(substitute(body('otp_login', 'sms'), vars), buildOtpMessage(code));
});
