/**
 * בדיקות יחידה למילוי האוטומטי (autofill). מכסות את הגזירה הטהורה של המשבצת שהתפנתה
 * ואת זרימת הטריגר עם הזרקת תלויות (ללא בסיס נתונים / ללא רשת):
 * מציאת המוביל הכשיר, קביעת החזקה עם טוקן וקישור תפיסה, שמירת מדיניות ה-first-come,
 * והשומרים: תור שלא בוטל / משבצת שנחטפה / אין התאמה / מרוץ על ההחזקה.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveFreedSlotFromAppointment,
  triggerWaitlistAutofillForAppointment,
  sendWaitlistOffer,
  HOLD_MINUTES,
  type AutofillDeps,
  type AutofillAppointment,
  type AutofillBusiness,
  type WaitlistSendResult,
  type OfferSendParams,
} from './autofill';
import type { WaitlistCandidate } from './match';

const TZ = 'Asia/Jerusalem';

// ----------------------- deriveFreedSlotFromAppointment (טהור) -----------------------

test('deriveFreedSlotFromAppointment: גוזר שירותים, צוות, תאריך ודקות מקומיות', () => {
  // ינואר בירושלים = UTC+2 (ללא שעון קיץ). 07:30Z → 09:30 מקומי → 570 דקות.
  const slot = deriveFreedSlotFromAppointment(
    {
      startAt: new Date('2026-01-15T07:30:00Z'),
      endAt: new Date('2026-01-15T08:15:00Z'),
      staffId: 'staff-1',
      services: [{ serviceId: 'svc-a' }, { serviceId: 'svc-b' }],
    },
    TZ,
  );
  assert.deepEqual(slot.serviceIds, ['svc-a', 'svc-b']);
  assert.equal(slot.staffId, 'staff-1');
  assert.equal(slot.dateStr, '2026-01-15');
  assert.equal(slot.startMinute, 570);
  assert.equal(slot.endMinute, 495 + 120); // 615
});

// ----------------------- עוזרי בדיקה לטריגר -----------------------

function candidate(over: Partial<WaitlistCandidate> & { id: string }): WaitlistCandidate {
  return {
    serviceId: null,
    staffId: null,
    desiredDate: null,
    earliestMinute: null,
    latestMinute: null,
    status: 'WAITING',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

const APPT: AutofillAppointment = {
  id: 'appt-1',
  businessId: 'biz-1',
  staffId: 'staff-1',
  startAt: new Date('2026-01-15T07:30:00Z'),
  endAt: new Date('2026-01-15T08:15:00Z'),
  status: 'CANCELLED',
  services: [{ serviceId: 'svc-a' }],
};

const BUSINESS: AutofillBusiness = {
  name: 'מספרת שון',
  timezone: TZ,
  remindersEnabled: true,
  reminderChannel: 'AUTO',
};

const FIXED_NOW = new Date('2026-01-15T06:00:00Z');

type SendCall = OfferSendParams;

function makeDeps(over: Partial<AutofillDeps> = {}): {
  deps: AutofillDeps;
  sends: SendCall[];
  holds: { entryId: string; input: { claimToken: string; holdExpiresAt: Date; heldAppointmentId: string | null } }[];
} {
  const sends: SendCall[] = [];
  const holds: { entryId: string; input: { claimToken: string; holdExpiresAt: Date; heldAppointmentId: string | null } }[] = [];
  let tokenSeq = 0;
  const deps: AutofillDeps = {
    getAppointment: async () => APPT,
    getBusiness: async () => BUSINESS,
    getCandidates: async () => [],
    slotHasConflict: async () => false,
    setHold: async (entryId, input) => {
      holds.push({ entryId, input });
      return true;
    },
    loadContact: async () => ({ name: 'דנה', phone: '+972500000001', email: null }),
    send: async (params) => {
      sends.push(params);
      return { status: 'sent', channel: 'WHATSAPP' } as WaitlistSendResult;
    },
    now: () => FIXED_NOW,
    makeToken: () => `tok-${++tokenSeq}`,
    ...over,
  };
  return { deps, sends, holds };
}

// ----------------------- triggerWaitlistAutofillForAppointment -----------------------

test('trigger: תור לא קיים → appointment_not_found', async () => {
  const { deps } = makeDeps({ getAppointment: async () => null });
  const out = await triggerWaitlistAutofillForAppointment('missing', deps);
  assert.deepEqual(out, { offered: false, reason: 'appointment_not_found' });
});

test('trigger: תור שאינו מבוטל → not_cancelled', async () => {
  const { deps } = makeDeps({
    getAppointment: async () => ({ ...APPT, status: 'CONFIRMED' }),
  });
  const out = await triggerWaitlistAutofillForAppointment('appt-1', deps);
  assert.deepEqual(out, { offered: false, reason: 'not_cancelled' });
});

test('trigger: המשבצת כבר נחטפה (התנגשות) → slot_taken', async () => {
  const { deps, holds } = makeDeps({
    slotHasConflict: async () => true,
    getCandidates: async () => [candidate({ id: 'w1' })],
  });
  const out = await triggerWaitlistAutofillForAppointment('appt-1', deps);
  assert.deepEqual(out, { offered: false, reason: 'slot_taken' });
  assert.equal(holds.length, 0);
});

test('trigger: אין ממתין מתאים → no_match', async () => {
  const { deps } = makeDeps({
    // מבקש שירות אחר מזה שהתפנה → לא מתאים.
    getCandidates: async () => [candidate({ id: 'w1', serviceId: 'svc-z' })],
  });
  const out = await triggerWaitlistAutofillForAppointment('appt-1', deps);
  assert.deepEqual(out, { offered: false, reason: 'no_match' });
});

test('trigger: מציע למוביל לפי ותק, קובע החזקה עם טוקן וקישור, ושולח', async () => {
  const early = candidate({ id: 'w-early', createdAt: new Date('2026-01-01T08:00:00Z') });
  const late = candidate({ id: 'w-late', createdAt: new Date('2026-01-02T08:00:00Z') });
  // מסופק בסדר הפוך כדי לוודא שהדירוג (ולא סדר הקלט) קובע.
  const { deps, sends, holds } = makeDeps({ getCandidates: async () => [late, early] });

  const out = await triggerWaitlistAutofillForAppointment('appt-1', deps);
  assert.equal(out.offered, true);
  if (!out.offered) return;
  assert.equal(out.entryId, 'w-early');
  assert.equal(out.claimToken, 'tok-1');
  // החזקה = עכשיו + HOLD_MINUTES.
  assert.equal(out.holdExpiresAt.getTime(), FIXED_NOW.getTime() + HOLD_MINUTES * 60_000);

  // ההחזקה נקבעה על המוביל, עם מזהה התור שהתפנה.
  assert.equal(holds.length, 1);
  assert.equal(holds[0].entryId, 'w-early');
  assert.equal(holds[0].input.heldAppointmentId, 'appt-1');
  assert.equal(holds[0].input.claimToken, 'tok-1');

  // נשלחה הודעה אחת שמכילה את קישור התפיסה עם הטוקן.
  assert.equal(sends.length, 1);
  assert.ok(sends[0].body.includes('/w/tok-1'), 'גוף ההודעה כולל את קישור התפיסה');
  assert.equal(sends[0].remindersEnabled, true);
});

test('trigger: מרוץ על ההחזקה — אם המוביל נתפס, עובר לבא בתור', async () => {
  const first = candidate({ id: 'w1', createdAt: new Date('2026-01-01T08:00:00Z') });
  const second = candidate({ id: 'w2', createdAt: new Date('2026-01-02T08:00:00Z') });
  const { deps, holds } = makeDeps({
    getCandidates: async () => [first, second],
    // setHold נכשל על הראשון (נתפס במקביל), מצליח על השני.
    setHold: async (entryId, input) => {
      holds.push({ entryId, input });
      return entryId === 'w2';
    },
  });
  const out = await triggerWaitlistAutofillForAppointment('appt-1', deps);
  assert.equal(out.offered, true);
  if (!out.offered) return;
  assert.equal(out.entryId, 'w2');
  // ננסה על שניהם, בסדר.
  assert.deepEqual(holds.map((h) => h.entryId), ['w1', 'w2']);
});

// ----------------------- sendWaitlistOffer (דגל התכונה) -----------------------

test('sendWaitlistOffer: דגל התזכורות כבוי → skipped (התור נשמר בתור)', async () => {
  const params: OfferSendParams = {
    email: 'a@b.com',
    phone: '+972500000001',
    channelPref: 'AUTO',
    remindersEnabled: false,
    subject: 'x',
    body: 'y',
  };
  const res = await sendWaitlistOffer(params);
  assert.deepEqual(res, { status: 'skipped', reason: 'reminders disabled' });
});

test('sendWaitlistOffer: אין מייל ואין טלפון → skipped', async () => {
  const res = await sendWaitlistOffer({
    email: null,
    phone: null,
    channelPref: 'AUTO',
    remindersEnabled: true,
    subject: 'x',
    body: 'y',
  });
  assert.equal(res.status, 'skipped');
});
