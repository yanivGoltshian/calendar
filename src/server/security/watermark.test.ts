import assert from 'node:assert/strict';
import test from 'node:test';
import { createWatermarkAuditId } from './watermark';

const env = { WATERMARK_AUDIT_SECRET: 'synthetic-watermark-secret-at-least-32-characters' };

test('watermark audit identifiers are stable, scoped and do not expose the subject', () => {
  const first = createWatermarkAuditId('Owner@Example.com', env);
  assert.match(first, /^[A-F0-9]{10}$/);
  assert.equal(first, createWatermarkAuditId(' owner@example.com ', env));
  assert.notEqual(first, createWatermarkAuditId('other@example.com', env));
  assert.equal(first.includes('OWNER'), false);
});

test('watermark audit identifiers require a strong server secret', () => {
  assert.throws(() => createWatermarkAuditId('owner@example.com', {}), {
    message: 'watermark_audit_secret_missing',
  });
});
