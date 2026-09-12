import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProvisionInput } from './provisionInput';
import { businessOwnerWhere, isBusinessOwnerIdentity } from '@/lib/businessOwnerIdentity';
import { decideBusinessAdminRoute } from '@/app/b/[slug]/adminAccess';

function input(values: Record<string, string | undefined>) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: 'Prepared business',
    type: 'BARBERSHOP',
    ...values,
  })) {
    if (value !== undefined) form.set(key, value);
  }
  return parseProvisionInput(form);
}

test('provisioning supports email, phone and both, with normalized login identities', () => {
  for (const values of [
    { email: ' Customer@Example.com ' },
    { phone: '050-1234567' },
    { phone: '+972501234567', email: 'customer@example.com' },
  ]) {
    const result = input(values);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error('Expected valid input');
    assert.equal(
      result.value.ownerEmail,
      values.email ? 'customer@example.com' : '972501234567@phone.torchick.local',
    );
    assert.equal(
      result.value.phoneIdentity,
      values.phone ? '972501234567@phone.torchick.local' : null,
    );
  }
});

test('provisioning rejects missing, malformed and reserved identities', () => {
  for (const values of [
    {},
    { email: 'bad' },
    { phone: 'hello0501234567' },
    { phone: '0123' },
    { email: '972501234567@phone.torchick.local' },
    { email: 'valid@example.com', phone: 'invalid' },
    { email: 'valid@example.com', type: 'INVALID' },
    { email: 'valid@example.com', name: ' ' },
  ])
    assert.equal(input(values).ok, false);
});

test('provisioning allows import URL to supply name and type, but validates the URL', () => {
  const imported = input({
    email: 'valid@example.com',
    name: '',
    type: '',
    importUrl: 'https://example.com/business',
  });
  assert.equal(imported.ok, true);
  if (!imported.ok) throw new Error('Expected valid import input');
  assert.equal(imported.value.name, null);
  assert.equal(imported.value.type, null);
  assert.equal(imported.value.importUrl, 'https://example.com/business');

  assert.equal(
    input({
      email: 'valid@example.com',
      name: '',
      type: '',
      importUrl: 'javascript:alert(1)',
    }).ok,
    false,
  );
  assert.equal(
    input({
      email: 'valid@example.com',
      name: '',
      type: '',
      importUrl: 'https://user:pass@example.com',
    }).ok,
    false,
  );
});

test('only the explicitly assigned owner phone is an alternate identity, never a public contact', () => {
  const business = {
    ownerEmail: 'owner@example.com',
    ownerPhoneIdentity: '972501234567@phone.torchick.local',
  };
  assert.equal(isBusinessOwnerIdentity(' OWNER@EXAMPLE.COM ', business), true);
  assert.equal(isBusinessOwnerIdentity(business.ownerPhoneIdentity, business), true);
  assert.equal(isBusinessOwnerIdentity('other@example.com', business), false);
  assert.equal(isBusinessOwnerIdentity(null, business), false);
  assert.equal(
    isBusinessOwnerIdentity(business.ownerPhoneIdentity, {
      ownerEmail: business.ownerEmail,
    }),
    false,
  );
  assert.equal(
    decideBusinessAdminRoute({
      email: business.ownerPhoneIdentity,
      ...business,
      isPlatformAdmin: false,
    }),
    'owner',
  );
  assert.deepEqual(businessOwnerWhere(business.ownerPhoneIdentity).OR, [
    { ownerEmail: { equals: business.ownerPhoneIdentity, mode: 'insensitive' } },
    { ownerPhoneIdentity: business.ownerPhoneIdentity },
  ]);
});
