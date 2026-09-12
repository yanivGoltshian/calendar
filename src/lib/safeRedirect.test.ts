import assert from 'node:assert/strict';
import test from 'node:test';
import { isSafeInternalRedirect, safeInternalRedirect } from './safeRedirect';

test('safeInternalRedirect accepts ordinary internal paths with query and fragment', () => {
  for (const value of [
    '/account',
    '/admin/calendar?view=week',
    '/b/%D7%A2%D7%A1%D7%A7#booking',
  ]) {
    assert.equal(isSafeInternalRedirect(value), true, value);
    assert.equal(safeInternalRedirect(value, '/account'), value);
  }
});

test('safeInternalRedirect rejects external, protocol-relative and script targets', () => {
  for (const value of [
    'https://evil.example',
    'javascript:alert(1)',
    '//evil.example/path',
    '/\\evil.example',
    '/%5cevil.example',
    '/%2f%2fevil.example',
    '/%252f%252fevil.example',
    '/safe\u0000path',
    '/bad%ZZ',
  ]) {
    assert.equal(isSafeInternalRedirect(value), false, value);
    assert.equal(safeInternalRedirect(value, '/account'), '/account');
  }
});

test('safeInternalRedirect uses the requested internal fallback for missing values', () => {
  assert.equal(safeInternalRedirect(null, '/business/resume'), '/business/resume');
  assert.equal(safeInternalRedirect('', '/business/resume'), '/business/resume');
});
