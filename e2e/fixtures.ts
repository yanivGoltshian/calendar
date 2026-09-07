import { test as base, expect } from '@playwright/test';
import { BASE_URL } from './helpers';

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return url.origin === new URL(BASE_URL).origin || url.protocol === 'data:' || url.protocol === 'blob:'
        ? route.continue() : route.abort('blockedbyclient');
    });
    await use(context);
  },
});
export { expect };
