import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  getUpgradeContactDefaults,
  resolveUpgradeAccessMode,
  type UpgradeAccessContext,
  type UpgradeBusinessIdentity,
} from './upgradeAccess';

const business: UpgradeBusinessIdentity = {
  id: 'business-1',
  name: 'המספרה של דוד',
  ownerEmail: 'owner@example.com',
  ownerPhoneIdentity: null,
  phone: '0501234567',
};

test('upgrade access accepts the owner and uses the owner session contact', () => {
  const mode = resolveUpgradeAccessMode({
    actorEmail: ' OWNER@example.com ',
    business,
    validatedImpersonatedBusinessId: null,
  });
  assert.equal(mode, 'owner');
  assert.ok(mode);

  const context: UpgradeAccessContext<UpgradeBusinessIdentity> = {
    actor: { email: 'OWNER@example.com', name: 'דוד' },
    business,
    mode,
  };
  assert.deepEqual(getUpgradeContactDefaults(context), {
    name: 'דוד',
    email: 'OWNER@example.com',
    phone: '0501234567',
  });
});

test('upgrade access accepts validated impersonation without using admin contact', () => {
  const mode = resolveUpgradeAccessMode({
    actorEmail: 'platform-admin@example.com',
    business,
    validatedImpersonatedBusinessId: business.id,
  });
  assert.equal(mode, 'platform-impersonation');
  assert.ok(mode);

  const context: UpgradeAccessContext<UpgradeBusinessIdentity> = {
    actor: { email: 'platform-admin@example.com', name: 'מנהל המערכת' },
    business,
    mode,
  };
  assert.deepEqual(getUpgradeContactDefaults(context), {
    name: business.name,
    email: business.ownerEmail,
    phone: business.phone,
  });
  assert.notEqual(getUpgradeContactDefaults(context).email, context.actor.email);
});

test('upgrade access rejects unrelated actors and mismatched impersonation targets', () => {
  assert.equal(
    resolveUpgradeAccessMode({
      actorEmail: 'stranger@example.com',
      business,
      validatedImpersonatedBusinessId: null,
    }),
    null,
  );
  assert.equal(
    resolveUpgradeAccessMode({
      actorEmail: 'platform-admin@example.com',
      business,
      validatedImpersonatedBusinessId: 'different-business',
    }),
    null,
  );
});

test('upgrade page and submit action share validated server authorization without form tenant ids', () => {
  const src = join(dirname(fileURLToPath(import.meta.url)), '..');
  const upgradeDir = join(src, 'app', 'admin', 'upgrade');
  const authorization = readFileSync(
    join(src, 'server', 'upgradeAuthorization.ts'),
    'utf8',
  );
  const component = readFileSync(join(upgradeDir, 'UpgradeQuote.tsx'), 'utf8');
  const action = readFileSync(join(upgradeDir, 'actions.ts'), 'utf8');

  assert.ok(authorization.includes('getImpersonatedBusinessId'));
  assert.ok(authorization.includes('resolveUpgradeAccessMode'));
  assert.ok(authorization.includes('allowInactive: true'));
  assert.ok(component.includes('getAuthorizedUpgradeContext'));
  assert.ok(action.includes('getAuthorizedUpgradeContext'));
  assert.equal(action.includes("formData.get('businessId')"), false);
  assert.equal(action.includes('cookies()'), false);
});
