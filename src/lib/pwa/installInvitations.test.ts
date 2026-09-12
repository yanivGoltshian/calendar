import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canInviteInstall, INSTALL_INVITATION_COOLDOWN, readInstallInvitation } from './installInvitations';

test('installation invitations stop after three displays and respect the exact daily cooldown', () => {
  const first = readInstallInvitation(null)!;
  assert.equal(canInviteInstall(first, 1000), true);
  const shown = { shown: 1, lastShownAt: 1000, disabled: false };
  assert.equal(canInviteInstall(shown, 999), false);
  assert.equal(canInviteInstall(shown, 1000 + INSTALL_INVITATION_COOLDOWN - 1), false);
  assert.equal(canInviteInstall(shown, 1000 + INSTALL_INVITATION_COOLDOWN), true);
  assert.equal(canInviteInstall({ ...shown, shown: 3 }, Number.MAX_SAFE_INTEGER), false);
  assert.equal(canInviteInstall({ ...first, disabled: true }, Number.MAX_SAFE_INTEGER), false);
});

test('invalid installation preference storage fails closed', () => {
  for (const raw of ['{', 'null', '[]', '{}', '"text"', 'x'.repeat(1001),
    '{"shown":4,"lastShownAt":0,"disabled":false}',
    '{"shown":-1,"lastShownAt":0,"disabled":false}',
    '{"shown":0.5,"lastShownAt":0,"disabled":false}',
    '{"shown":1,"lastShownAt":-1,"disabled":false}',
    '{"shown":1,"lastShownAt":0,"disabled":"false"}']) {
    assert.equal(readInstallInvitation(raw), null, raw);
  }
  const state = { shown: 2, lastShownAt: 123, disabled: false };
  assert.deepEqual(readInstallInvitation(JSON.stringify(state)), state);
});
