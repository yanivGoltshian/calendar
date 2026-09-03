import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProfile,
  parsePolicy,
  parseReminders,
  parseOwnerNotifications,
  parseLandingHeroImages,
  parseMessageTemplates,
} from './parse';
import { resolveTemplateSave } from '@/server/messages/save';
import { getChannelDefault } from '@/server/messages/registry';

/** בונה FormData מאובייקט פשוט. */
function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

test('parseProfile: ממפה שדות, ריק ⇐ null, וברירת מחדל אזור זמן', () => {
  const res = parseProfile(
    form({
      name: '  מספרת הדני  ',
      type: 'BARBERSHOP',
      phone: '050-1234567',
      address: '',
      logoUrl: 'data:image/png;base64,AAAA',
    }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.data.name, 'מספרת הדני');
  assert.equal(res.data.type, 'BARBERSHOP');
  assert.equal(res.data.phone, '050-1234567');
  assert.equal(res.data.address, null);
  assert.equal(res.data.logoUrl, 'data:image/png;base64,AAAA');
  assert.equal(res.data.coverImageUrl, null);
  assert.equal(res.data.timezone, 'Asia/Jerusalem');
});

test('parseProfile: משמיט landingContent ו-publicPageStyle לשימור ערכי המסד', () => {
  // עורך הנחיתה הוסר מההגדרות; parseProfile לא אמור להחזיר את שני השדות האלה,
  // כדי ש-updateBusinessProfile (כותב רק כשהערך !== undefined) ישמר את הקיים במסד.
  const res = parseProfile(
    form({
      name: 'עסק',
      type: 'BARBERSHOP',
      publicPageStyle: 'BOOKING',
      landingContent: '{"heroHeadline":"שלום"}',
    }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal('publicPageStyle' in res.data, false);
  assert.equal('landingContent' in res.data, false);
});

test('parseProfile: שם חסר ⇐ שגיאת name', () => {
  const res = parseProfile(form({ name: '   ' }));
  assert.deepEqual(res, { ok: false, error: 'name' });
});

test('parseProfile: סוג עסק לא חוקי ⇐ שגיאת bad_request', () => {
  const res = parseProfile(form({ name: 'עסק', type: 'NOT_A_TYPE' }));
  assert.deepEqual(res, { ok: false, error: 'bad_request' });
});

test('parseProfile: בלי סוג ⇐ type null', () => {
  const res = parseProfile(form({ name: 'עסק' }));
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.data.type, null);
});

test('parsePolicy: ממפה מספרים ותיבת אישור', () => {
  const res = parsePolicy(
    form({
      minLeadTimeMinutes: '30',
      cancellationWindowHours: '24',
      slotGranularityMinutes: '15',
      maxAdvanceBookingDays: '60',
      bookingRequiresApproval: 'on',
    }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.data, {
    minLeadTimeMinutes: 30,
    cancellationWindowHours: 24,
    slotGranularityMinutes: 15,
    maxAdvanceBookingDays: 60,
    bookingRequiresApproval: true,
  });
});

test('parsePolicy: מספר לא חוקי ⇐ שגיאת number', () => {
  const res = parsePolicy(
    form({
      minLeadTimeMinutes: 'abc',
      cancellationWindowHours: '24',
      slotGranularityMinutes: '15',
      maxAdvanceBookingDays: '60',
    }),
  );
  assert.deepEqual(res, { ok: false, error: 'number' });
});

test('parseReminders: ערוץ חוקי נשמר', () => {
  const res = parseReminders(
    form({
      remindersEnabled: 'on',
      reminderChannel: 'SMS',
      reminderLeadHours: '3',
      confirmationRequired: 'on',
    }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.data, {
    remindersEnabled: true,
    reminderChannel: 'SMS',
    reminderLeadHours: 3,
    confirmationRequired: true,
  });
});

test('parseReminders: ערוץ לא חוקי ⇐ AUTO', () => {
  const res = parseReminders(
    form({ reminderChannel: 'CARRIER_PIGEON', reminderLeadHours: '2' }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.data.reminderChannel, 'AUTO');
});

test('parseReminders: שעות התראה לא חוקיות ⇐ שגיאת number', () => {
  const res = parseReminders(form({ reminderLeadHours: 'xyz' }));
  assert.deepEqual(res, { ok: false, error: 'number' });
});

test('parseOwnerNotifications: תיבות מסומנות ⇐ true', () => {
  const res = parseOwnerNotifications(
    form({ notifyOnBooking: 'on', notifyOnCancellation: 'on', pushEnabled: 'on' }),
  );
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.data, {
    notifyOnBooking: true,
    notifyOnCancellation: true,
    pushEnabled: true,
  });
});

test('parseOwnerNotifications: תיבות חסרות ⇐ false (טופס לא מסמן = כבוי)', () => {
  const res = parseOwnerNotifications(form({}));
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.data, {
    notifyOnBooking: false,
    notifyOnCancellation: false,
    pushEnabled: false,
  });
});

test('parseOwnerNotifications: מיפוי חלקי — רק הזמנה דלוקה', () => {
  const res = parseOwnerNotifications(form({ notifyOnBooking: 'on' }));
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.data.notifyOnBooking, true);
  assert.equal(res.data.notifyOnCancellation, false);
  assert.equal(res.data.pushEnabled, false);
});

test('parseLandingHeroImages: קורא עד שתי תמונות ומדלג על ריקות', () => {
  const images = parseLandingHeroImages(
    form({ heroImage0: '  data:image/jpeg;base64,AAAA  ', heroImage1: 'data:image/jpeg;base64,BBBB' }),
  );
  assert.deepEqual(images, ['data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB']);
});

test('parseLandingHeroImages: בלי שדות ⇐ מערך ריק', () => {
  assert.deepEqual(parseLandingHeroImages(form({})), []);
});

test('parseLandingHeroImages: מדלג על תמונה ראשונה ריקה ושומר את השנייה', () => {
  const images = parseLandingHeroImages(form({ heroImage0: '   ', heroImage1: 'data:image/jpeg;base64,CCCC' }));
  assert.deepEqual(images, ['data:image/jpeg;base64,CCCC']);
});

test('parseMessageTemplates: מחזיר ערך לכל מפתח × ערוץ נתמך, ומנקה רווחים', () => {
  const entries = parseMessageTemplates(
    form({
      'tmpl.booking_confirmation.email.subject': '  נושא ערוך  ',
      'tmpl.booking_confirmation.email.body': '  גוף ערוך  ',
      'tmpl.booking_confirmation.sms.body': '  מסרון ערוך  ',
    }),
  );
  // 5 מפתחות × 2 ערוצים = 10 ערכים.
  assert.equal(entries.length, 10);

  const email = entries.find((e) => e.key === 'booking_confirmation' && e.channel === 'email');
  assert.deepEqual(email, {
    key: 'booking_confirmation',
    channel: 'email',
    subject: 'נושא ערוך',
    body: 'גוף ערוך',
  });

  const sms = entries.find((e) => e.key === 'booking_confirmation' && e.channel === 'sms');
  assert.deepEqual(sms, {
    key: 'booking_confirmation',
    channel: 'sms',
    subject: null,
    body: 'מסרון ערוך',
  });
});

test('parseMessageTemplates: SMS לעולם אינו קורא נושא (גם אם נשלח)', () => {
  const entries = parseMessageTemplates(
    form({
      'tmpl.booking_confirmation.sms.subject': 'לא רלוונטי',
      'tmpl.booking_confirmation.sms.body': 'גוף',
    }),
  );
  const sms = entries.find((e) => e.key === 'booking_confirmation' && e.channel === 'sms');
  assert.equal(sms?.subject, null);
});

test('parseMessageTemplates → resolveTemplateSave: עריכה נשמרת, ריק/ברירת-מחדל נמחקים (round-trip)', () => {
  const def = getChannelDefault('booking_confirmation', 'email')!;
  const entries = parseMessageTemplates(
    form({
      // ערוך → upsert
      'tmpl.booking_confirmation.email.subject': 'נושא חדש',
      'tmpl.booking_confirmation.email.body': 'גוף חדש',
      // ריק → delete (שחזור)
      'tmpl.booking_approval.email.body': '',
      // זהה לברירת מחדל → delete
      'tmpl.reminder.email.subject': getChannelDefault('reminder', 'email')!.subject!,
      'tmpl.reminder.email.body': getChannelDefault('reminder', 'email')!.body,
    }),
  );
  const byId = (key: string, channel: string) =>
    entries.find((e) => e.key === key && e.channel === channel)!;

  assert.deepEqual(resolveTemplateSave(byId('booking_confirmation', 'email')), {
    action: 'upsert',
    subject: 'נושא חדש',
    body: 'גוף חדש',
  });
  assert.deepEqual(resolveTemplateSave(byId('booking_approval', 'email')), { action: 'delete' });
  assert.deepEqual(resolveTemplateSave(byId('reminder', 'email')), { action: 'delete' });
  // שדות שלא נשלחו בטופס: גוף ריק ⇒ delete (שחזור), מבטיח אי-שמירה בטעות.
  assert.deepEqual(resolveTemplateSave(byId('waitlist_freed', 'sms')), { action: 'delete' });
  assert.ok(def.body.length > 0);
});
