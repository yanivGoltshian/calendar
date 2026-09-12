import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasActiveClientEmailAccess } from './deliveryPolicy';

const future = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

test('מייל ללקוחות זמין לעסק פעיל בחבילת בסיס', () => {
  assert.equal(
    hasActiveClientEmailAccess({
      accountStatus: 'ACTIVE',
      plan: 'basic',
      subscriptionStatus: 'trialing',
      trialEndsAt: future(),
      paidUntil: null,
    }),
    true,
  );
});

test('מייל ללקוחות חסום לעסק שפג תוקפו או שממתין למחיקה', () => {
  assert.equal(
    hasActiveClientEmailAccess({
      accountStatus: 'ACTIVE',
      plan: 'basic',
      subscriptionStatus: 'expired',
      trialEndsAt: new Date(0),
      paidUntil: null,
    }),
    false,
  );
  assert.equal(
    hasActiveClientEmailAccess({
      accountStatus: 'PENDING_DELETION',
      plan: 'exclusive',
      subscriptionStatus: 'active',
      trialEndsAt: null,
      paidUntil: future(),
    }),
    false,
  );
});
