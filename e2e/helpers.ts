/**
 * Shared helpers for the E2E specs.
 *
 * The whole suite is "green by default": unless `E2E_BASE_URL` is explicitly
 * provided, every spec skips itself instead of failing. This keeps the suite
 * safe to run anywhere — CI, a laptop with an unrelated server on :3000, etc.
 * These helpers centralise that gating so the specs stay declarative.
 */

/**
 * True only when the operator explicitly opted in by setting `E2E_BASE_URL`.
 * Gating on this (rather than mere reachability of the default localhost:3000)
 * means a stray/unrelated dev server never turns the suite red.
 */
export const E2E_ENABLED = !!process.env.E2E_BASE_URL;

export const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

/** Slug of a seeded business, required by the DB-backed booking specs. */
export const BUSINESS_SLUG = process.env.E2E_BUSINESS_SLUG || '';

/**
 * Opt-in flag for the booking happy-path spec, which WRITES a real appointment
 * to the database. Off by default so CI/local runs never mutate data.
 */
export const ALLOW_BOOKING = process.env.E2E_ALLOW_BOOKING === '1';

const reachabilityCache = new Map<string, boolean>();

/**
 * Returns true only when the suite is enabled (`E2E_BASE_URL` set) AND `baseURL`
 * answers an HTTP response within `timeoutMs`. When `E2E_BASE_URL` is not set we
 * short-circuit to false so the suite stays green by default. Result is cached
 * per-URL for the run so we ping at most once.
 */
export async function serverReachable(baseURL: string = BASE_URL, timeoutMs = 3000): Promise<boolean> {
  // No explicit opt-in → treat as unreachable so every spec skips.
  if (!E2E_ENABLED) return false;

  const cached = reachabilityCache.get(baseURL);
  if (cached !== undefined) return cached;

  let reachable = false;
  try {
    const res = await fetch(baseURL, { signal: AbortSignal.timeout(timeoutMs) });
    // Any HTTP status (even 404) means a server is listening.
    reachable = res.status > 0;
  } catch {
    reachable = false;
  }
  reachabilityCache.set(baseURL, reachable);
  return reachable;
}
