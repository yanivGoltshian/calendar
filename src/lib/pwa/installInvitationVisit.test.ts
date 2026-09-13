import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INSTALL_INVITATION_COOLDOWN,
  readInstallInvitation,
  type InstallInvitationState,
} from './installInvitations';
import {
  INSTALL_INVITATION_DELAY,
  INSTALL_INVITATION_RETRY_DELAY,
  installInvitationKey,
  nextInstallInvitation,
} from './installInvitationVisit';

const context = {
  now: 1000,
  handledThisVisit: false,
  installed: false,
  visible: true,
  interacting: false,
};

test('the invitation waits eight seconds initially and retries busy pages after two seconds', () => {
  assert.equal(INSTALL_INVITATION_DELAY, 8000);
  assert.equal(INSTALL_INVITATION_RETRY_DELAY, 2000);
});

test('three separate visits can show once each, at least 24 hours apart', () => {
  let state: InstallInvitationState = readInstallInvitation(null)!;
  for (const shown of [1, 2, 3]) {
    const now = context.now + (shown - 1) * INSTALL_INVITATION_COOLDOWN;
    const result = nextInstallInvitation(state, { ...context, now });
    assert.equal(result.action, 'show');
    if (result.action !== 'show') throw new Error('Expected an invitation');
    assert.deepEqual(result.state, { shown, lastShownAt: now, disabled: false });
    assert.equal(state.shown, shown - 1);
    state = result.state;
    assert.deepEqual(nextInstallInvitation(state, {
      ...context,
      now: now + INSTALL_INVITATION_COOLDOWN - 1,
    }), { action: 'stop' });
  }
  assert.deepEqual(nextInstallInvitation(state, {
    ...context,
    now: Number.MAX_SAFE_INTEGER,
  }), { action: 'stop' });
});

test('an invitation or manual installation attempt suppresses remounts for the whole visit', () => {
  for (const state of [
    readInstallInvitation(null)!,
    { shown: 1, lastShownAt: 1, disabled: false },
  ]) {
    assert.deepEqual(nextInstallInvitation(state, {
      ...context,
      now: INSTALL_INVITATION_COOLDOWN * 2,
      handledThisVisit: true,
    }), { action: 'stop' });
  }
});

test('busy or hidden pages defer without consuming an invitation, then recover', () => {
  const state = readInstallInvitation(null)!;
  for (const busy of [
    { visible: false, interacting: false },
    { visible: true, interacting: true },
    { visible: false, interacting: true },
  ]) {
    assert.deepEqual(nextInstallInvitation(state, { ...context, ...busy }), { action: 'wait' });
    assert.equal(state.shown, 0);
  }
  assert.equal(nextInstallInvitation(state, context).action, 'show');
});

test('installation, opt-out, cooldown and exhausted budgets stop even on busy pages', () => {
  const first = readInstallInvitation(null)!;
  for (const state of [
    { ...first, disabled: true },
    { shown: 3, lastShownAt: 1, disabled: false },
    { shown: 1, lastShownAt: context.now, disabled: false },
  ]) {
    assert.deepEqual(nextInstallInvitation(state, {
      ...context,
      visible: false,
      interacting: true,
    }), { action: 'stop' });
  }
  assert.deepEqual(nextInstallInvitation(first, { ...context, installed: true }), {
    action: 'stop',
  });
});

test('malformed storage and invalid or reversed clocks fail closed', () => {
  for (const raw of ['{', '{}', '{"shown":4,"lastShownAt":0,"disabled":false}']) {
    assert.deepEqual(nextInstallInvitation(readInstallInvitation(raw), context), {
      action: 'stop',
    });
  }
  for (const now of [NaN, Infinity, -1]) {
    assert.deepEqual(nextInstallInvitation(readInstallInvitation(null), {
      ...context,
      now,
    }), { action: 'stop' });
  }
  assert.deepEqual(
    nextInstallInvitation({ shown: 1, lastShownAt: 1001, disabled: false }, context),
    { action: 'stop' },
  );
});

test('business and admin scopes retain existing per-business preference keys', () => {
  const business = installInvitationKey('business', '/b/david');
  assert.equal(business, 'torchick:install-invite:v1:business:david');
  assert.equal(installInvitationKey('business', '/b/david/book'), business);
  assert.equal(installInvitationKey('business', '/b/%64avid'), business);
  assert.notEqual(installInvitationKey('business', '/b/another'), business);
  assert.equal(
    installInvitationKey(
      'admin',
      '/admin',
      'https://example.invalid/admin/manifest?slug=david',
    ),
    'torchick:install-invite:v1:admin:david',
  );
  assert.equal(
    installInvitationKey(
      'admin',
      '/admin',
      'https://example.invalid/manifest.webmanifest',
      'david',
    ),
    'torchick:install-invite:v1:admin:david',
  );
  assert.equal(
    installInvitationKey(
      'business',
      '/b/david',
      'https://example.invalid/manifest?slug=another',
    ),
    business,
  );
});

test('missing, unrelated or malformed business identities never create an invitation scope', () => {
  for (const path of ['/', '/business/david', '/b/', '/b/%E0%A4']) {
    assert.equal(installInvitationKey('business', path), null);
  }
  assert.equal(installInvitationKey('platform', '/b/david'), null);
  assert.equal(installInvitationKey('superadmin', '/b/david'), null);
  assert.equal(installInvitationKey('admin', '/admin'), null);
  assert.equal(installInvitationKey('admin', '/admin', 'invalid url'), null);
  assert.equal(
    installInvitationKey('admin', '/admin', 'https://example.invalid/manifest'),
    null,
  );
});
