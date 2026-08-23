import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifyTrialNotice,
  buildTrialExpiryEmail,
  notifyOwnerOfTrialExpiry,
  TRIAL_WARN_DAYS,
  type TrialExpiryNotifyDeps,
} from './trialExpiry';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-01-01T08:00:00.000Z');
const at = (ms: number) => new Date(NOW.getTime() + ms);

// ── classifyTrialNotice ─────────────────────────────────────────────────────

test('classifyTrialNotice: null/undefined trialEndsAt → null', () => {
  assert.equal(classifyTrialNotice(null, NOW), null);
  assert.equal(classifyTrialNotice(undefined, NOW), null);
});

test('classifyTrialNotice: exactly 3 days out → warn', () => {
  assert.equal(classifyTrialNotice(at(TRIAL_WARN_DAYS * DAY), NOW), 'warn');
});

test('classifyTrialNotice: warn window edges (±12h around 3d) → warn', () => {
  assert.equal(classifyTrialNotice(at(TRIAL_WARN_DAYS * DAY - 11 * HOUR), NOW), 'warn');
  assert.equal(classifyTrialNotice(at(TRIAL_WARN_DAYS * DAY + 11 * HOUR), NOW), 'warn');
});

test('classifyTrialNotice: outside warn window (3d+13h) → null', () => {
  assert.equal(classifyTrialNotice(at(TRIAL_WARN_DAYS * DAY + 13 * HOUR), NOW), null);
});

test('classifyTrialNotice: at expiry moment → expired', () => {
  assert.equal(classifyTrialNotice(at(0), NOW), 'expired');
});

test('classifyTrialNotice: just before and just after expiry (±11h) → expired', () => {
  assert.equal(classifyTrialNotice(at(-11 * HOUR), NOW), 'expired');
  assert.equal(classifyTrialNotice(at(11 * HOUR), NOW), 'expired');
});

test('classifyTrialNotice: between tiers (1 day left) → null', () => {
  assert.equal(classifyTrialNotice(at(1 * DAY), NOW), null);
});

test('classifyTrialNotice: long past expiry (2 days ago) → null', () => {
  assert.equal(classifyTrialNotice(at(-2 * DAY), NOW), null);
});

test('classifyTrialNotice: far future (10 days) → null', () => {
  assert.equal(classifyTrialNotice(at(10 * DAY), NOW), null);
});

// ── buildTrialExpiryEmail ───────────────────────────────────────────────────

test('buildTrialExpiryEmail: warn interpolates name, business and day count', () => {
  const { subject, text, html } = buildTrialExpiryEmail('warn', {
    ownerName: 'דנה',
    businessName: 'מספרת דנה',
    ctaUrl: 'https://torchick.example/admin/upgrade',
  });
  assert.match(subject, new RegExp(String(TRIAL_WARN_DAYS)));
  assert.match(text, /דנה/);
  assert.match(text, /מספרת דנה/);
  assert.match(html, /מספרת דנה/);
  assert.ok(!text.includes('{name}') && !text.includes('{business}') && !text.includes('{days}'));
  assert.ok(!html.includes('{name}') && !html.includes('{business}') && !html.includes('{days}'));
});

test('buildTrialExpiryEmail: expired tier uses expiry copy and greets owner', () => {
  const { subject, text } = buildTrialExpiryEmail('expired', {
    ownerName: 'יוסי',
    businessName: 'ברברשופ יוסי',
    ctaUrl: 'https://torchick.example/admin/upgrade',
  });
  assert.match(subject, /הסתיימה/);
  assert.match(text, /שלום יוסי/);
});

test('buildTrialExpiryEmail: ctaUrl appears as link when provided', () => {
  const url = 'https://torchick.example/admin/upgrade';
  const { text, html } = buildTrialExpiryEmail('warn', {
    ownerName: 'דנה',
    businessName: 'מספרת דנה',
    ctaUrl: url,
  });
  assert.ok(text.includes(url));
  assert.ok(html.includes(`href="${url}"`));
});

test('buildTrialExpiryEmail: empty ctaUrl → no anchor tag', () => {
  const { html } = buildTrialExpiryEmail('expired', {
    ownerName: 'דנה',
    businessName: 'מספרת דנה',
    ctaUrl: '',
  });
  assert.ok(!html.includes('<a '));
});

// ── notifyOwnerOfTrialExpiry (structured, never throws) ──────────────────────

function makeDeps(overrides: Partial<TrialExpiryNotifyDeps> = {}): {
  deps: TrialExpiryNotifyDeps;
  sent: Array<{ to: string; subject: string }>;
} {
  const sent: Array<{ to: string; subject: string }> = [];
  const deps: TrialExpiryNotifyDeps = {
    sendEmail: (async (to: string, subject: string) => {
      sent.push({ to, subject });
    }) as TrialExpiryNotifyDeps['sendEmail'],
    canonicalOrigin: () => 'https://torchick.example',
    ...overrides,
  };
  return { deps, sent };
}

test('notifyOwnerOfTrialExpiry: sends warn email to owner in window', async () => {
  const { deps, sent } = makeDeps();
  const r = await notifyOwnerOfTrialExpiry(
    {
      businessId: 'b1',
      businessName: 'מספרת דנה',
      ownerEmail: 'owner@example.com',
      ownerName: 'דנה',
      trialEndsAt: at(TRIAL_WARN_DAYS * DAY),
    },
    NOW,
    deps,
  );
  assert.equal(r.tier, 'warn');
  assert.equal(r.emailed, true);
  assert.equal(r.skipped, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.to, 'owner@example.com');
});

test('notifyOwnerOfTrialExpiry: no tier → skip, no email', async () => {
  const { deps, sent } = makeDeps();
  const r = await notifyOwnerOfTrialExpiry(
    { businessId: 'b1', businessName: 'X', ownerEmail: 'o@e.com', trialEndsAt: at(1 * DAY) },
    NOW,
    deps,
  );
  assert.equal(r.tier, null);
  assert.equal(r.skipped, true);
  assert.equal(r.emailed, false);
  assert.equal(sent.length, 0);
});

test('notifyOwnerOfTrialExpiry: in window but no owner email → skip', async () => {
  const { deps, sent } = makeDeps();
  const r = await notifyOwnerOfTrialExpiry(
    { businessId: 'b1', businessName: 'X', ownerEmail: null, trialEndsAt: at(0) },
    NOW,
    deps,
  );
  assert.equal(r.tier, 'expired');
  assert.equal(r.skipped, true);
  assert.equal(r.emailed, false);
  assert.equal(sent.length, 0);
});

test('notifyOwnerOfTrialExpiry: sendEmail throws → captured, never rethrows', async () => {
  const { deps } = makeDeps({
    sendEmail: (async () => {
      throw new Error('smtp down');
    }) as TrialExpiryNotifyDeps['sendEmail'],
  });
  const r = await notifyOwnerOfTrialExpiry(
    {
      businessId: 'b1',
      businessName: 'X',
      ownerEmail: 'o@e.com',
      trialEndsAt: at(0),
    },
    NOW,
    deps,
  );
  assert.equal(r.emailed, false);
  assert.equal(r.skipped, false);
  assert.match(r.error ?? '', /smtp down/);
});

test('notifyOwnerOfTrialExpiry: falls back to business name when owner name missing', async () => {
  const { deps, sent } = makeDeps();
  const r = await notifyOwnerOfTrialExpiry(
    {
      businessId: 'b1',
      businessName: 'מספרת דנה',
      ownerEmail: 'o@e.com',
      ownerName: null,
      trialEndsAt: at(0),
    },
    NOW,
    deps,
  );
  assert.equal(r.emailed, true);
  assert.match(sent[0]!.subject, /הסתיימה/);
});
