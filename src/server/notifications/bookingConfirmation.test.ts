import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConfirmationEmail, type BookingConfirmationPayload } from './bookingConfirmation';
import { buildApprovalEmail } from './clientApproval';
import { safeMessageLink } from '../messages/safeLink';

const payload: BookingConfirmationPayload = {
  appointmentId: 'test', businessId: 'business', clientName: '<a href="https://evil.test">guest</a>',
  businessName: '<img src=x onerror=alert(1)>', businessAddress: '<svg onload=alert(1)>',
  businessPhone: '"><strong>phone</strong>', services: [{ name: '<script>alert(1)</script>' }],
  startAt: new Date('2030-01-01T12:00:00Z'), timezone: 'Asia/Jerusalem',
  canEmail: true, canWhatsapp: false, manageUrl: 'https://example.test/c/id?a=1&b=2',
};

test('default confirmation and approval emails escape every interpolated HTML value', () => {
  for (const rendered of [
    buildConfirmationEmail(payload),
    buildApprovalEmail({ ...payload, businessId: 'business', isExclusive: false }),
  ]) {
    assert.ok(!rendered.html.includes('<script>'));
    assert.ok(!rendered.html.includes('<img'));
    assert.ok(!rendered.html.includes('<svg'));
    assert.ok(!rendered.html.includes('<strong>phone'));
    assert.ok(rendered.html.includes('&lt;script&gt;'));
    assert.ok(rendered.html.includes('&lt;a href=&quot;https://evil.test&quot;&gt;'));
    assert.ok(rendered.html.includes('href="https://example.test/c/id?a=1&amp;b=2"'));
    assert.ok(rendered.text.includes('לבטל את התור ולהזמין תור חדש'));
    assert.ok(!rendered.text.includes('לשינוי מועד או לביטול'));
  }
});

test('message links reject executable schemes, credentials and attribute injection', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.test', 'https://x.test/" onmouseover="x', 'https://u:p@example.test', 'https://x.test/\\evil']) {
    assert.equal(safeMessageLink(url), null);
    assert.ok(!buildConfirmationEmail({ ...payload, manageUrl: url }).html.includes('<a href='));
  }
  assert.equal(safeMessageLink('https://example.test/c/123'), 'https://example.test/c/123');
});
