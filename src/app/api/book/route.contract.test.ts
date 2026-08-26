import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { resolveGuestIdentity } from '@/server/booking/guestIdentity';

/**
 * מבחני חוזה + מדיניות עבור מסלול ההזמנה POST `src/app/api/book/route.ts`.
 *
 * למה מבחן חוזה ולא ייבוא ישיר של ה-handler:
 * ה-handler הוא server-only — הוא קורא ל-`getClientSession()` (עוגיות) ול-Prisma,
 * ו-`bodySchema` שלו אינו מיוצא. אילוץ ה-additive-only אוסר לשנות/לייצא את פנימיות
 * המסלול. לכן קובץ זה נועל את החוזה החיצוני הנצפה של המסלול ואת החלטות המדיניות
 * המתועדות שלו, בעוד שהמסלול המלא מכוסה התנהגותית על-ידי מבחני ה-e2e של ההזמנה
 * (`e2e/booking-stepper.spec.ts`, `e2e/booking-happy-path.spec.ts`).
 *
 * ולידטורי הזהות (טלפון/מייל) הם הפונקציות האמיתיות מ-`@/lib/crypto` שהמסלול משתמש
 * בהן, וחוקת הזהות עצמה מיובאת כפונקציה האמיתית `resolveGuestIdentity`
 * מ-`@/server/booking/guestIdentity` (אותה פונקציה שהמסלול קורא לה, ללא שכפול). הסכימה
 * ושאר החלטות המדיניות משוכפלות במדויק מ-route.ts וחייבות להישמר מסונכרנות עם:
 *   - bodySchema            → route.ts:18-26
 *   - מדיניות קשר לפי מסלול → route.ts:71
 *   - מתגי משפך האורח       → route.ts:74-75 (allowNoPhone / requireVerification)
 *   - חוקת זהות אורח        → route.ts:93-96
 *   - שער אימות טלפון       → route.ts:107-109 (guest → verification_required)
 *   - שיוך staff לעסק       → route.ts:113-116
 *   - שער זמן (lead/advance)→ route.ts:124-142
 *   - סטטוס לפי מדיניות      → route.ts:133, 164
 */

// --- חוזה גוף הבקשה (מראה של bodySchema, route.ts:16-24) ---
const bookRequestContract = z.object({
  slug: z.string().min(1),
  staffId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1),
  startAtUtc: z.string().datetime(),
  name: z.string().trim().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'demo-salon',
    staffId: 'staff-1',
    serviceIds: ['svc-1'],
    startAtUtc: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    name: 'דנה',
    phone: '0501234567',
    ...overrides,
  };
}

test('חוזה הבקשה: גוף תקין מלא עובר ולידציה', () => {
  const result = bookRequestContract.safeParse(validBody());
  assert.equal(result.success, true);
});

test('חוזה הבקשה: staffId הוא שדה חובה (חסר או ריק נכשל)', () => {
  // staffId נדרש — זהו כלל "staffId required" של המסלול (route.ts:18).
  const missing = validBody();
  delete (missing as Record<string, unknown>).staffId;
  assert.equal(bookRequestContract.safeParse(missing).success, false);

  const empty = validBody({ staffId: '' });
  assert.equal(bookRequestContract.safeParse(empty).success, false);
});

test('חוזה הבקשה: serviceIds חייב להכיל לפחות מזהה אחד לא-ריק', () => {
  assert.equal(bookRequestContract.safeParse(validBody({ serviceIds: [] })).success, false);
  assert.equal(bookRequestContract.safeParse(validBody({ serviceIds: [''] })).success, false);
  assert.equal(bookRequestContract.safeParse(validBody({ serviceIds: ['svc-1', 'svc-2'] })).success, true);
});

test('חוזה הבקשה: startAtUtc חייב להיות ISO 8601 עם זמן', () => {
  assert.equal(bookRequestContract.safeParse(validBody({ startAtUtc: 'not-a-date' })).success, false);
  assert.equal(bookRequestContract.safeParse(validBody({ startAtUtc: '2025-01-01' })).success, false);
  assert.equal(bookRequestContract.safeParse(validBody({ startAtUtc: '2025-01-01T09:00:00.000Z' })).success, true);
});

// --- חוקת זהות אורח: הפונקציה האמיתית `resolveGuestIdentity` (route.ts משתמש בה ישירות) ---

test('זהות אורח: שם + טלפון תקין מתקבל ומנורמל ל-E.164', () => {
  const r = resolveGuestIdentity('דנה', '050-123-4567');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.phone, '+972501234567');
    assert.equal(r.email, undefined);
  }
});

test('זהות אורח: שם + מייל תקין מתקבל ומנורמל (lowercase/trim)', () => {
  const r = resolveGuestIdentity('דנה', undefined, '  Dana@Example.COM ');
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.email, 'dana@example.com');
    assert.equal(r.phone, undefined);
  }
});

test('זהות אורח: חסר שם או חסרים גם טלפון וגם מייל → bad_request', () => {
  assert.deepEqual(resolveGuestIdentity('', undefined, 'dana@example.com'), { ok: false, error: 'bad_request' });
  assert.deepEqual(resolveGuestIdentity('דנה', undefined, undefined), { ok: false, error: 'bad_request' });
  assert.deepEqual(resolveGuestIdentity('  ', '  '), { ok: false, error: 'bad_request' });
});

test('זהות אורח: טלפון לא-תקין → invalid_phone; מייל לא-תקין → invalid_email', () => {
  // קווי-נייח נדחה כטלפון לא-נייד.
  assert.deepEqual(resolveGuestIdentity('דנה', '021234567'), { ok: false, error: 'invalid_phone' });
  assert.deepEqual(resolveGuestIdentity('דנה', undefined, 'no-at-sign'), { ok: false, error: 'invalid_email' });
});

// --- מדיניות פרטי קשר לפי מסלול (route.ts: business.plan !== 'premium' → requireBoth) ---

// מראה של החלטת המסלול: סטנדרט (basic) מחייב שני פרטים, פרימיום מתיר אחד.
function requireBothForPlan(plan: string): boolean {
  return plan !== 'premium';
}

test('מדיניות מסלול: basic דורש שני פרטים, premium דורש אחד', () => {
  assert.equal(requireBothForPlan('basic'), true);
  assert.equal(requireBothForPlan('premium'), false);
});

test('מדיניות סטנדרט (requireBoth): חובה גם טלפון וגם מייל', () => {
  // חסר מייל → email_required; חסר טלפון → phone_required.
  assert.deepEqual(
    resolveGuestIdentity('דנה', '0501234567', undefined, { requireBoth: true }),
    { ok: false, error: 'email_required' },
  );
  assert.deepEqual(
    resolveGuestIdentity('דנה', undefined, 'dana@example.com', { requireBoth: true }),
    { ok: false, error: 'phone_required' },
  );
  // שם ריק עדיין נכשל תחילה על bad_request.
  assert.deepEqual(
    resolveGuestIdentity('', '0501234567', 'dana@example.com', { requireBoth: true }),
    { ok: false, error: 'bad_request' },
  );
});

test('מדיניות סטנדרט (requireBoth): שני פרטים תקינים מתקבלים ומנורמלים', () => {
  const r = resolveGuestIdentity('דנה', '050-123-4567', '  Dana@Example.COM ', { requireBoth: true });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.phone, '+972501234567');
    assert.equal(r.email, 'dana@example.com');
  }
});

test('מדיניות פרימיום (requireBoth=false): טלפון בלבד מתקבל', () => {
  const r = resolveGuestIdentity('דנה', '0501234567', undefined, { requireBoth: false });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.phone, '+972501234567');
    assert.equal(r.email, undefined);
  }
});

test('מדיניות פרימיום (requireBoth=false): מייל בלבד עדיין מתקבל (תאימות לאחור)', () => {
  const r = resolveGuestIdentity('דנה', undefined, 'dana@example.com', { requireBoth: false });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.phone, undefined);
    assert.equal(r.email, 'dana@example.com');
  }
});

// --- משפך "אורח תחילה": רמות זהות ומתגי העסק (route.ts:74-75, 93-109) ---

// מראה של שער האימות במסלול: כשהעסק דורש אימות טלפון, מסלול האורח (ללא OTP) חסום.
// לקוח מחובר (session) עוקף את השער כי הוא מאומת דרך OTP/Firebase → VERIFIED.
type VerificationLevel = 'VERIFIED' | 'UNVERIFIED' | 'NONE';
function guestVerificationGate(
  requireVerification: boolean,
  hasSession: boolean,
): { ok: true; verification: VerificationLevel } | { ok: false; error: 'verification_required' } {
  if (hasSession) return { ok: true, verification: 'VERIFIED' };
  if (requireVerification) return { ok: false, error: 'verification_required' };
  return { ok: true, verification: 'UNVERIFIED' };
}

test('שער אימות: העסק דורש אימות + אורח ללא התחברות → verification_required', () => {
  assert.deepEqual(guestVerificationGate(true, false), { ok: false, error: 'verification_required' });
});

test('שער אימות: לקוח מחובר עוקף את הדרישה → VERIFIED', () => {
  assert.deepEqual(guestVerificationGate(true, true), { ok: true, verification: 'VERIFIED' });
});

test('שער אימות: אימות כבוי → אורח מתקבל (זהות תיקבע לפי פרטי הקשר)', () => {
  assert.deepEqual(guestVerificationGate(false, false), { ok: true, verification: 'UNVERIFIED' });
});

test('רמת זהות: אורח עם טלפון (ללא OTP) → UNVERIFIED', () => {
  const r = resolveGuestIdentity('דנה', '0501234567');
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.verificationStatus, 'UNVERIFIED');
});

test('רמת זהות NONE: העסק מתיר הזמנה ללא טלפון (allowNoContact) → שם בלבד, NONE', () => {
  const r = resolveGuestIdentity('סבתא רבקה', undefined, undefined, { allowNoContact: true });
  assert.deepEqual(r, {
    ok: true,
    name: 'סבתא רבקה',
    phone: undefined,
    email: undefined,
    verificationStatus: 'NONE',
  });
});

test('מתג allowNoContact גובר על requireBoth: אורח ללא פרטי קשר עובר', () => {
  const r = resolveGuestIdentity('סבתא רבקה', undefined, undefined, {
    requireBoth: true,
    allowNoContact: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.verificationStatus, 'NONE');
});

// --- אמון בעל העסק: הזמנות/לקוחות שנוצרו מהאדמין (admin/actions.ts, clients/actions.ts) ---

// מראה של החלטת האמון המתועדת: בעל העסק יוצר תור/כרטיס עבור לקוח — יש טלפון → VERIFIED,
// אין טלפון → NONE (בעל העסק מהימן ואינו צריך OTP).
function ownerCreatedVerification(phone: string | null | undefined): VerificationLevel {
  return phone && phone.trim() ? 'VERIFIED' : 'NONE';
}

test('אמון בעל העסק: יצירה עם טלפון → VERIFIED', () => {
  assert.equal(ownerCreatedVerification('0501234567'), 'VERIFIED');
});

test('אמון בעל העסק: יצירה ללא טלפון → NONE', () => {
  assert.equal(ownerCreatedVerification(null), 'NONE');
  assert.equal(ownerCreatedVerification('   '), 'NONE');
});

// --- שדרוג-בלבד של רמת האימות (מראה של findOrCreateClient, clients.ts:8-9, 55-59) ---

// דירוג הרמות; שדרוג מוחל רק כאשר הנכנס גבוה מהקיים (לעולם לא מורידים רמה).
const verificationRank: Record<VerificationLevel, number> = { NONE: 0, UNVERIFIED: 1, VERIFIED: 2 };
function upgradeVerification(current: VerificationLevel, incoming: VerificationLevel): VerificationLevel {
  return verificationRank[incoming] > verificationRank[current] ? incoming : current;
}

test('שדרוג-בלבד: NONE→UNVERIFIED→VERIFIED משדרגים כלפי מעלה', () => {
  assert.equal(upgradeVerification('NONE', 'UNVERIFIED'), 'UNVERIFIED');
  assert.equal(upgradeVerification('UNVERIFIED', 'VERIFIED'), 'VERIFIED');
  assert.equal(upgradeVerification('NONE', 'VERIFIED'), 'VERIFIED');
});

test('שדרוג-בלבד: לעולם לא מורידים רמה קיימת', () => {
  assert.equal(upgradeVerification('VERIFIED', 'UNVERIFIED'), 'VERIFIED');
  assert.equal(upgradeVerification('VERIFIED', 'NONE'), 'VERIFIED');
  assert.equal(upgradeVerification('UNVERIFIED', 'NONE'), 'UNVERIFIED');
});

// --- פרדיקט ההתראה: אילו רמות מסומנות לבעל העסק (badge + ספירה) ---

// מראה של סימון ההתראה: לקוחות/תורים ברמת UNVERIFIED או NONE דורשים תשומת לב;
// VERIFIED אינו מסומן. תואם ל-countUnverifiedUpcomingAppointments ולתגי האדמין.
function needsAttention(level: VerificationLevel): boolean {
  return level === 'UNVERIFIED' || level === 'NONE';
}

test('פרדיקט התראה: UNVERIFIED ו-NONE מסומנים; VERIFIED אינו מסומן', () => {
  assert.equal(needsAttention('UNVERIFIED'), true);
  assert.equal(needsAttention('NONE'), true);
  assert.equal(needsAttention('VERIFIED'), false);
});

// --- שיוך איש צוות לעסק (מראה של route.ts:113-116) ---
type StaffLite = { id: string };
function resolveStaffOrError(staff: StaffLite[], staffId: string): { ok: true } | { ok: false; error: 'invalid_staff' } {
  const found = staff.find((m) => m.id === staffId);
  return found ? { ok: true } : { ok: false, error: 'invalid_staff' };
}

test('שיוך צוות: staffId ששייך לעסק מתקבל; זר/לא-קיים → invalid_staff', () => {
  const staff: StaffLite[] = [{ id: 'staff-1' }, { id: 'staff-2' }];
  assert.deepEqual(resolveStaffOrError(staff, 'staff-2'), { ok: true });
  assert.deepEqual(resolveStaffOrError(staff, 'staff-foreign'), { ok: false, error: 'invalid_staff' });
  assert.deepEqual(resolveStaffOrError([], 'staff-1'), { ok: false, error: 'invalid_staff' });
});

// --- סטטוס לפי מדיניות אישור (מראה של route.ts:118-121, 151) ---
function resolveBookingStatus(bookingRequiresApproval?: boolean): 'PENDING' | 'CONFIRMED' {
  // ברירת מחדל: אישור כבוי (route.ts:121 → `?? false`).
  const requiresApproval = bookingRequiresApproval ?? false;
  return requiresApproval ? 'PENDING' : 'CONFIRMED';
}

test('מדיניות סטטוס: אישור כבוי → CONFIRMED; אישור דלוק → PENDING', () => {
  assert.equal(resolveBookingStatus(false), 'CONFIRMED');
  assert.equal(resolveBookingStatus(true), 'PENDING');
});

test('מדיניות סטטוס: ברירת מחדל כשאין הגדרה היא CONFIRMED (אישור כבוי)', () => {
  assert.equal(resolveBookingStatus(undefined), 'CONFIRMED');
});

// --- שער זמן: lead-time / max-advance (מראה של route.ts:112-130) ---
type TimeGuard = 'ok' | 'invalid_time' | 'too_early' | 'too_far';
function evaluateStartTime(
  startAtUtc: string,
  now: number,
  opts?: { minLeadMinutes?: number; maxAdvanceDays?: number },
): TimeGuard {
  const minLeadMinutes = opts?.minLeadMinutes ?? 120; // route.ts:119
  const maxAdvanceDays = opts?.maxAdvanceDays ?? 60; // route.ts:120
  const startAt = new Date(startAtUtc);
  if (Number.isNaN(startAt.getTime()) || startAt.getTime() <= now) return 'invalid_time';
  if (startAt.getTime() < now + minLeadMinutes * 60_000) return 'too_early';
  if (startAt.getTime() > now + maxAdvanceDays * 24 * 60 * 60 * 1000) return 'too_far';
  return 'ok';
}

test('שער זמן: התחלה בעבר → invalid_time', () => {
  const now = Date.parse('2025-06-01T12:00:00.000Z');
  assert.equal(evaluateStartTime('2025-06-01T11:59:00.000Z', now), 'invalid_time');
});

test('שער זמן: פחות מ-120 דקות קדימה → too_early; בדיוק על הסף → ok', () => {
  const now = Date.parse('2025-06-01T12:00:00.000Z');
  // 119 דקות קדימה — מוקדם מדי.
  assert.equal(evaluateStartTime('2025-06-01T13:59:00.000Z', now), 'too_early');
  // בדיוק 120 דקות קדימה — עובר (הבדיקה היא `<` על הסף).
  assert.equal(evaluateStartTime('2025-06-01T14:00:00.000Z', now), 'ok');
});

test('שער זמן: מעבר ל-60 יום קדימה → too_far', () => {
  const now = Date.parse('2025-06-01T12:00:00.000Z');
  const beyond = new Date(now + 61 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(evaluateStartTime(beyond, now), 'too_far');
});
