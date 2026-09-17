import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  manualReviewSchema,
  reviewEditSchema,
  reviewInputSchema,
} from './businessReviews';

test('review stars are required, integral and bounded; optional text is trimmed', () => {
  for (const rating of [undefined, null, '', true, false, 0, -1, 6, 2.5, NaN, Infinity]) {
    assert.equal(
      reviewInputSchema.safeParse({ name: 'Synthetic', rating, text: '' }).success,
      false,
    );
  }
  for (const rating of [1, 2, 3, 4, 5, '4']) {
    for (const text of ['', '   ', ' Optional text ']) {
      const parsed = reviewInputSchema.parse({ name: ' Synthetic ', rating, text });
      assert.equal(parsed.name, 'Synthetic');
      assert.equal(parsed.rating, Number(rating));
      assert.equal(parsed.text, text.trim());
    }
  }
});

test('new review text and display name have explicit limits', () => {
  for (const name of ['', ' ', 'n'.repeat(41)]) {
    assert.equal(
      reviewInputSchema.safeParse({ name, rating: 5, text: '' }).success,
      false,
    );
  }
  assert.equal(
    reviewInputSchema.safeParse({ name: 'n', rating: 5, text: 'x'.repeat(240) }).success,
    true,
  );
  assert.equal(
    reviewInputSchema.safeParse({ name: 'n', rating: 5, text: 'x'.repeat(241) }).success,
    false,
  );
});

test('manual requests cannot set customer/Google origin or forge an existing customer', () => {
  const parsed = manualReviewSchema.parse({
    name: 'Synthetic owner entry',
    rating: 5,
    text: '',
    status: 'PENDING',
    requestKey: randomUUID(),
    origin: 'CUSTOMER',
    source: { provider: 'google' },
    authorUserId: 'victim',
    appointmentId: 'other',
  });
  assert.deepEqual(Object.keys(parsed).sort(), [
    'name',
    'rating',
    'requestKey',
    'status',
    'text',
  ]);
});

test('edits require an explicit nonnegative version and a valid status', () => {
  const input = { id: 'review', rating: '4', text: '', status: 'PUBLISHED' };
  for (const version of [undefined, null, '', true, -1, 1.5]) {
    assert.equal(reviewEditSchema.safeParse({ ...input, version }).success, false);
  }
  assert.equal(reviewEditSchema.parse({ ...input, version: '0' }).version, 0);
  assert.equal(
    reviewEditSchema.safeParse({ ...input, version: 0, status: 'APPROVED' }).success,
    false,
  );
});
