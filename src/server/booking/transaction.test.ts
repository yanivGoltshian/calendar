import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import { isRetryableBookingTransactionError } from './transaction';

test('retry row-lock serialization failures while propagating unrelated raw-query errors', () => {
  const error = (code: string, sqlCode?: string) => new Prisma.PrismaClientKnownRequestError('synthetic', {
    code, clientVersion: '6', meta: sqlCode ? { code: sqlCode } : undefined,
  });
  assert.equal(isRetryableBookingTransactionError(error('P2010', '40001')), true);
  assert.equal(isRetryableBookingTransactionError(error('P2034')), true);
  assert.equal(isRetryableBookingTransactionError(error('P2002')), true);
  assert.equal(isRetryableBookingTransactionError(error('P2010', '42P01')), false);
  assert.equal(isRetryableBookingTransactionError(error('P2010')), false);
  assert.equal(isRetryableBookingTransactionError(new Error('40001')), false);
});
