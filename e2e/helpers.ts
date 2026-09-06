import { requireIsolatedDatabase } from '../integration/fixtures';

requireIsolatedDatabase();
export const BASE_URL = process.env.E2E_BASE_URL ?? '';
export const BUSINESS_SLUG = process.env.E2E_BUSINESS_SLUG ?? '';
export const ALLOW_BOOKING = process.env.E2E_ALLOW_BOOKING === '1';
export const E2E_ENABLED = true;

if (!BASE_URL || !['localhost', '127.0.0.1'].includes(new URL(BASE_URL).hostname) ||
    !BUSINESS_SLUG || !ALLOW_BOOKING) {
  throw new Error('Run npm run test:release with a disposable local database and app; remote mutations are forbidden');
}

export async function serverReachable(): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/api/version`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Isolated app version endpoint is unavailable');
  return true;
}
