import { test } from 'node:test';
import assert from 'node:assert/strict';

import { describeAuthError } from './authErrors';

test('null / undefined / מחרוזת ריקה → null (אין באנר שגיאה)', () => {
  assert.equal(describeAuthError(null), null);
  assert.equal(describeAuthError(undefined), null);
  assert.equal(describeAuthError(''), null);
});

test('Configuration → configuration (הבאג שדווח בפרודקשן ב-Google)', () => {
  assert.equal(describeAuthError('Configuration'), 'configuration');
});

test('AccessDenied → accessDenied; Verification → verification', () => {
  assert.equal(describeAuthError('AccessDenied'), 'accessDenied');
  assert.equal(describeAuthError('Verification'), 'verification');
});

test('כל קודי ה-OAuth וה-Callback → oauth', () => {
  for (const code of [
    'OAuthSignin',
    'OAuthCallback',
    'OAuthCallbackError',
    'OAuthCreateAccount',
    'OAuthAccountNotLinked',
    'Callback',
  ]) {
    assert.equal(describeAuthError(code), 'oauth', `${code} אמור להתמפות ל-oauth`);
  }
});

test('קוד לא-מוכר → generic', () => {
  assert.equal(describeAuthError('SomethingElse'), 'generic');
  assert.equal(describeAuthError('SessionRequired'), 'generic');
});
