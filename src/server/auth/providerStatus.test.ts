import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeAuthProviderStatus } from './providerStatus';

test('email פעיל תמיד, גם בסביבה ריקה לגמרי (מסלול מייל בלבד עובד תמיד)', () => {
  const status = computeAuthProviderStatus({});
  assert.equal(status.email, true);
  assert.equal(status.google, false);
  assert.equal(status.firebasePhone, false);
});

test('google פעיל רק כששני משתני ה-env קיימים', () => {
  assert.equal(
    computeAuthProviderStatus({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }).google,
    true,
  );
  // רק אחד מהם אינו מספיק.
  assert.equal(computeAuthProviderStatus({ GOOGLE_CLIENT_ID: 'id' }).google, false);
  assert.equal(computeAuthProviderStatus({ GOOGLE_CLIENT_SECRET: 'secret' }).google, false);
  // ערך ריק נחשב כלא-מוגדר.
  assert.equal(
    computeAuthProviderStatus({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' }).google,
    false,
  );
});

test('firebasePhone פעיל רק כשמפתח ה-Firebase קיים', () => {
  assert.equal(
    computeAuthProviderStatus({ NEXT_PUBLIC_FIREBASE_API_KEY: 'key' }).firebasePhone,
    true,
  );
  assert.equal(computeAuthProviderStatus({}).firebasePhone, false);
  assert.equal(
    computeAuthProviderStatus({ NEXT_PUBLIC_FIREBASE_API_KEY: '' }).firebasePhone,
    false,
  );
});

test('כל הספקים פעילים כשהסביבה מלאה', () => {
  const status = computeAuthProviderStatus({
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
    NEXT_PUBLIC_FIREBASE_API_KEY: 'key',
  });
  assert.deepEqual(status, { google: true, email: true, firebasePhone: true });
});
