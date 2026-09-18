import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatReturningCustomerGreeting,
  shouldRenderReturningCustomer,
} from './returningCustomerLogic';

test('returning customer widget renders only when an appointment exists', () => {
  assert.equal(shouldRenderReturningCustomer(0, 0), false);
  assert.equal(shouldRenderReturningCustomer(1, 0), true);
  assert.equal(shouldRenderReturningCustomer(0, 1), true);
});

test('customer greeting includes the connected customer name', () => {
  assert.equal(formatReturningCustomerGreeting('דנה כהן'), 'שלום דנה כהן');
  assert.equal(formatReturningCustomerGreeting('  דנה  '), 'שלום דנה');
  assert.equal(formatReturningCustomerGreeting(''), 'שלום');
});
