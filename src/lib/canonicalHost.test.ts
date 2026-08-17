import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalRedirectTarget,
  getCanonicalOrigin,
} from './canonicalHost';

// ה-host הלא-קנוני מהבאג בפרודקשן (ה-FQDN המובנה של Azure) וה-origin הקנוני הממותג.
const AZURE_FQDN = 'torchick-app-prod.calmpebble-38456f2e.westeurope.azurecontainerapps.io';
const CANONICAL = 'https://torchick.duckdns.org';

test('getCanonicalOrigin: APP_CANONICAL_URL קודם לכל השאר', () => {
  const origin = getCanonicalOrigin({
    APP_CANONICAL_URL: 'https://torchick.duckdns.org',
    AUTH_URL: 'https://auth.example.com',
    NEXTAUTH_URL: 'https://nextauth.example.com',
    NEXT_PUBLIC_APP_URL: 'https://public.example.com',
  });
  assert.equal(origin, 'https://torchick.duckdns.org');
});

test('getCanonicalOrigin: נופל ל-AUTH_URL, ואז NEXTAUTH_URL, ואז NEXT_PUBLIC_APP_URL', () => {
  assert.equal(
    getCanonicalOrigin({ AUTH_URL: 'https://a.example.com' }),
    'https://a.example.com',
  );
  assert.equal(
    getCanonicalOrigin({ NEXTAUTH_URL: 'https://n.example.com' }),
    'https://n.example.com',
  );
  assert.equal(
    getCanonicalOrigin({ NEXT_PUBLIC_APP_URL: 'https://p.example.com' }),
    'https://p.example.com',
  );
});

test('getCanonicalOrigin: מנרמל ל-origin בלבד (בלי path / סלאש סופי)', () => {
  assert.equal(
    getCanonicalOrigin({ APP_CANONICAL_URL: 'https://torchick.duckdns.org/' }),
    'https://torchick.duckdns.org',
  );
  assert.equal(
    getCanonicalOrigin({ APP_CANONICAL_URL: 'https://torchick.duckdns.org/business/login' }),
    'https://torchick.duckdns.org',
  );
});

test('getCanonicalOrigin: null כשריק / לא תקין', () => {
  assert.equal(getCanonicalOrigin({}), null);
  assert.equal(getCanonicalOrigin({ AUTH_URL: '' }), null);
  assert.equal(getCanonicalOrigin({ AUTH_URL: '   ' }), null);
  assert.equal(getCanonicalOrigin({ AUTH_URL: 'not-a-url' }), null);
  assert.equal(getCanonicalOrigin({ AUTH_URL: 'ftp://x.example.com' }), null);
});

test('canonicalRedirectTarget: התרחיש מהבאג, Azure FQDN מופנה לדומיין הקנוני עם שמירת path+query', () => {
  const target = canonicalRedirectTarget({
    method: 'GET',
    host: AZURE_FQDN,
    pathname: '/business/login',
    search: '?redirect=%2Fadmin',
    canonicalOrigin: CANONICAL,
  });
  assert.equal(target, 'https://torchick.duckdns.org/business/login?redirect=%2Fadmin');
});

test('canonicalRedirectTarget: HEAD מופנה גם כן', () => {
  const target = canonicalRedirectTarget({
    method: 'HEAD',
    host: AZURE_FQDN,
    pathname: '/',
    search: '',
    canonicalOrigin: CANONICAL,
  });
  assert.equal(target, 'https://torchick.duckdns.org/');
});

test('canonicalRedirectTarget: no-op כשה-host כבר קנוני (כולל אי-רגישות לאותיות)', () => {
  assert.equal(
    canonicalRedirectTarget({
      method: 'GET',
      host: 'torchick.duckdns.org',
      pathname: '/business/login',
      search: '',
      canonicalOrigin: CANONICAL,
    }),
    null,
  );
  assert.equal(
    canonicalRedirectTarget({
      method: 'GET',
      host: 'Torchick.DuckDNS.org',
      pathname: '/',
      search: '',
      canonicalOrigin: CANONICAL,
    }),
    null,
  );
});

test('canonicalRedirectTarget: no-op ל-POST ולמתודות לא-אידמפוטנטיות', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.equal(
      canonicalRedirectTarget({
        method,
        host: AZURE_FQDN,
        pathname: '/api/whatever',
        search: '',
        canonicalOrigin: CANONICAL,
      }),
      null,
      `expected no-op for ${method}`,
    );
  }
});

test('canonicalRedirectTarget: no-op כשאין origin קנוני / אין host', () => {
  assert.equal(
    canonicalRedirectTarget({
      method: 'GET',
      host: AZURE_FQDN,
      pathname: '/',
      search: '',
      canonicalOrigin: null,
    }),
    null,
  );
  assert.equal(
    canonicalRedirectTarget({
      method: 'GET',
      host: null,
      pathname: '/',
      search: '',
      canonicalOrigin: CANONICAL,
    }),
    null,
  );
});

test('canonicalRedirectTarget: no-op למארחים פנימיים / probes (loopback, IP, שם ללא נקודה)', () => {
  for (const host of ['localhost', 'localhost:3000', '127.0.0.1', '127.0.0.1:3000', '10.0.0.5', 'internal-probe']) {
    assert.equal(
      canonicalRedirectTarget({
        method: 'GET',
        host,
        pathname: '/',
        search: '',
        canonicalOrigin: CANONICAL,
      }),
      null,
      `expected no-op for internal host ${host}`,
    );
  }
});

test('canonicalRedirectTarget: no-op כשה-origin הקנוני עצמו הוא localhost (פיתוח מקומי)', () => {
  assert.equal(
    canonicalRedirectTarget({
      method: 'GET',
      host: AZURE_FQDN,
      pathname: '/',
      search: '',
      canonicalOrigin: 'http://localhost:3000',
    }),
    null,
  );
});
