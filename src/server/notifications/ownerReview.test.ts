import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { notifyOwnerOfReview } from './ownerReview';

test('private customer review pages are excluded from offline navigation caches', () => {
  const source = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8');
  const result = runInNewContext(
    `${source}\nisPrivateNavigation({ url: 'https://example.invalid/b/clinic/reviews/new' });`,
    { URL, self: { addEventListener() {} } },
  );
  assert.equal(result, true);
});

test('new-review push targets only the business provider and includes no review content or identity', async () => {
  const calls: unknown[][] = [];
  const push = {
    sendToBusiness: async (...args: [string, string, string, string?]) => {
      calls.push(args);
    },
  };
  await notifyOwnerOfReview(
    { businessId: 'business-a', reviewId: 'review-a', pushEnabled: false },
    push,
  );
  assert.equal(calls.length, 0);
  await notifyOwnerOfReview(
    { businessId: 'business-a', reviewId: 'review-a', pushEnabled: true },
    push,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'business-a');
  assert.equal(calls[0][3], '/admin/reviews?review=review-a&status=pending');
  assert.ok(String(calls[0][1]).includes('ממתינה לאישור'));
  assert.ok(!JSON.stringify(calls).includes('authorUserId'));
});

test('notification failure is logged without undoing a committed review', async (context) => {
  const error = context.mock.method(console, 'error', () => {});
  await notifyOwnerOfReview(
    { businessId: 'a', reviewId: 'b', pushEnabled: true },
    {
      sendToBusiness: async () => {
        throw new Error('Synthetic transport failure');
      },
    },
  );
  assert.equal(error.mock.callCount(), 1);
  assert.equal(error.mock.calls[0].arguments[0], 'review_owner_push_failed');
});

test('existing service worker refreshes only admin windows without broadcasting push contents', async () => {
  const callbacks = new Map<string, (event: unknown) => void>();
  const messages: { url: string; message: unknown }[] = [];
  const tasks: Promise<unknown>[] = [];
  const urls = [
    'https://example.invalid/admin',
    'https://example.invalid/admin/reviews',
    'https://example.invalid/b/clinic',
  ];
  runInNewContext(
    readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8'),
    {
      URL,
      self: {
        addEventListener: (name: string, callback: (event: unknown) => void) =>
          callbacks.set(name, callback),
        registration: { showNotification: async () => {} },
        clients: {
          matchAll: async () =>
            urls.map((url) => ({
              url,
              postMessage: (message: unknown) => messages.push({ url, message }),
            })),
        },
      },
    },
  );
  callbacks.get('push')!({
    data: {
      json: () => ({ title: 'Synthetic title', body: 'Never broadcast this body' }),
    },
    waitUntil: (task: Promise<unknown>) => tasks.push(task),
  });
  await Promise.all(tasks);
  assert.deepEqual(
    messages.map((message) => message.url),
    urls.slice(0, 2),
  );
  assert.equal(
    JSON.stringify(messages.map((message) => message.message)),
    JSON.stringify([
      { type: 'torchick:admin-notifications-changed' },
      { type: 'torchick:admin-notifications-changed' },
    ]),
  );
});
