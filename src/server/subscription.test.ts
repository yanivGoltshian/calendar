import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBusinessAccess,
  canAcceptPublicBookings,
  describePlan,
  canSendPaidClientSms,
  canVerifyClientPhone,
  canSendOwnerVerificationSms,
  type BusinessAccessInput,
} from './subscription';

const DAY_MS = 24 * 60 * 60 * 1000;
const future = (days: number) => new Date(Date.now() + days * DAY_MS);
const past = (days: number) => new Date(Date.now() - days * DAY_MS);

/** בסיס לבניית קלט; כל מקרה דורס את השדות הרלוונטיים. */
function input(overrides: Partial<BusinessAccessInput>): BusinessAccessInput {
  return {
    plan: 'basic',
    subscriptionStatus: 'trialing',
    trialEndsAt: null,
    paidUntil: null,
    ...overrides,
  };
}

test('בסיס בתקופת ניסיון פעילה ⇐ trialing ופעיל', () => {
  const access = getBusinessAccess(input({ plan: 'basic', trialEndsAt: future(5) }));
  assert.equal(access.active, true);
  assert.equal(access.state, 'trialing');
  assert.equal(access.daysLeft, 5);
});

test('בסיס עם ניסיון שפג ⇐ expired וחסום', () => {
  const access = getBusinessAccess(input({ plan: 'basic', trialEndsAt: past(1) }));
  assert.equal(access.active, false);
  assert.equal(access.state, 'expired');
  assert.equal(access.daysLeft, 0);
});

test('בסיס ללא תאריך ניסיון ⇐ expired', () => {
  const access = getBusinessAccess(input({ plan: 'basic', trialEndsAt: null }));
  assert.equal(access.state, 'expired');
  assert.equal(access.active, false);
});

test('פרימיום בתשלום פעיל ⇐ active', () => {
  const access = getBusinessAccess(
    input({ plan: 'premium', subscriptionStatus: 'active', paidUntil: future(10) }),
  );
  assert.equal(access.active, true);
  assert.equal(access.state, 'active');
});

test('פרימיום שפג תוקף התשלום ⇐ expired', () => {
  const access = getBusinessAccess(
    input({ plan: 'premium', subscriptionStatus: 'expired', paidUntil: past(2) }),
  );
  assert.equal(access.active, false);
  assert.equal(access.state, 'expired');
});

test('אקסקלוסיב בתשלום פעיל ⇐ active', () => {
  const access = getBusinessAccess(
    input({ plan: 'exclusive', subscriptionStatus: 'active', paidUntil: future(30) }),
  );
  assert.equal(access.active, true);
  assert.equal(access.state, 'active');
});

test('פרימיום ללא paidUntil ⇐ expired (גם אם trialEndsAt בעתיד)', () => {
  // מסלול בתשלום מתעלם מ-trialEndsAt; ללא paidUntil תקף ⇐ חסום.
  const access = getBusinessAccess(
    input({ plan: 'premium', paidUntil: null, trialEndsAt: future(5) }),
  );
  assert.equal(access.state, 'expired');
  assert.equal(access.active, false);
});

test('canAcceptPublicBookings=true רק כשהגישה פעילה', () => {
  assert.equal(
    canAcceptPublicBookings(input({ plan: 'basic', trialEndsAt: future(3) })),
    true,
  );
  assert.equal(
    canAcceptPublicBookings(
      input({ plan: 'premium', subscriptionStatus: 'active', paidUntil: future(3) }),
    ),
    true,
  );
});

test('canAcceptPublicBookings=false כשהניסיון או המנוי פג', () => {
  assert.equal(
    canAcceptPublicBookings(input({ plan: 'basic', trialEndsAt: past(1) })),
    false,
  );
  assert.equal(
    canAcceptPublicBookings(
      input({ plan: 'premium', subscriptionStatus: 'expired', paidUntil: past(1) }),
    ),
    false,
  );
});

test('describePlan returns distinct labels per plan', () => {
  const basic = describePlan('basic');
  const premium = describePlan('premium');
  const exclusive = describePlan('exclusive');
  assert.notEqual(exclusive, basic);
  assert.notEqual(exclusive, premium);
});

test('canSendPaidClientSms only for active exclusive', () => {
  assert.equal(canSendPaidClientSms(input({ plan: 'exclusive', paidUntil: future(30) })), true);
  assert.equal(canSendPaidClientSms(input({ plan: 'exclusive', paidUntil: past(1) })), false);
  assert.equal(canSendPaidClientSms(input({ plan: 'premium', paidUntil: future(30) })), false);
  assert.equal(canSendPaidClientSms(input({ plan: 'basic', trialEndsAt: future(30) })), false);
});

test('canVerifyClientPhone mirrors paid client sms gate', () => {
  assert.equal(canVerifyClientPhone(input({ plan: 'exclusive', paidUntil: future(30) })), true);
  assert.equal(canVerifyClientPhone(input({ plan: 'premium', paidUntil: future(30) })), false);
});

test('canSendOwnerVerificationSms always allowed', () => {
  assert.equal(canSendOwnerVerificationSms(), true);
});
