import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const serviceWorker = readFileSync(join(root, 'public', 'sw.js'), 'utf8');

type FetchListener = (event: {
  request: { method: string; mode: string; url: string };
  respondWith: (response: Promise<Response> | Response) => void;
}) => void;

function loadFetchListener({
  fetch,
  caches,
}: {
  fetch: (request: unknown) => Promise<Response>;
  caches: {
    open: (key: string) => Promise<{ addAll?: (urls: string[]) => Promise<void>; put: () => Promise<void> }>;
    match: () => Promise<Response | undefined>;
    keys: () => Promise<string[]>;
    delete: () => Promise<boolean>;
  };
}): FetchListener {
  const listeners = new Map<string, (...args: never[]) => unknown>();
  runInNewContext(serviceWorker, {
    URL,
    Response,
    console,
    fetch,
    caches,
    self: {
      addEventListener: (name: string, listener: (...args: never[]) => unknown) =>
        listeners.set(name, listener),
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    },
  });
  return listeners.get('fetch') as FetchListener;
}

test('service worker never caches or replays protected navigation responses', () => {
  assert.match(serviceWorker, /const PRIVATE_PATHS = \['\/admin', '\/superadmin', '\/account'\]/);
  assert.match(serviceWorker, /if \(isPrivateNavigation\(request\)\) \{\s*event\.respondWith\(fetch\(request\)\)/);
  assert.match(serviceWorker, /private\|no-store/);
});

test('service worker cache version invalidates earlier navigation entries', () => {
  assert.match(serviceWorker, /const CACHE = 'torchick-shell-v5'/);
  assert.match(serviceWorker, /keys\.filter\(\(k\) => k !== CACHE\)/);
  assert.match(serviceWorker, /shell_precache_failed/);
});

test('service worker returns a successful network response when cache storage fails', async () => {
  const fresh = new Response('fresh', {
    status: 200,
    headers: { 'cache-control': 'public, max-age=60' },
  });
  const listener = loadFetchListener({
    fetch: async () => fresh,
    caches: {
      open: async () => ({
        put: async () => {
          throw new Error('quota');
        },
      }),
      match: async () => new Response('stale'),
      keys: async () => [],
      delete: async () => true,
    },
  });
  let response: Promise<Response> | Response | undefined;
  listener({
    request: { method: 'GET', mode: 'navigate', url: 'https://app.example/public' },
    respondWith: (value) => {
      response = value;
    },
  });
  assert.equal(await (await response!).text(), 'fresh');
});

test('service worker bypasses cache APIs for protected navigation', async () => {
  let cacheCalls = 0;
  const listener = loadFetchListener({
    fetch: async () => new Response('protected'),
    caches: {
      open: async () => {
        cacheCalls += 1;
        return { put: async () => {} };
      },
      match: async () => {
        cacheCalls += 1;
        return undefined;
      },
      keys: async () => [],
      delete: async () => true,
    },
  });
  let response: Promise<Response> | Response | undefined;
  listener({
    request: { method: 'GET', mode: 'navigate', url: 'https://app.example/admin/clients' },
    respondWith: (value) => {
      response = value;
    },
  });
  assert.equal(await (await response!).text(), 'protected');
  assert.equal(cacheCalls, 0);
});

test('service worker still activates when shell precaching fails', async () => {
  const listeners = new Map<string, (...args: never[]) => unknown>();
  let skipped = false;
  runInNewContext(serviceWorker, {
    URL,
    Response,
    console,
    fetch: async () => new Response(),
    caches: {
      open: async () => ({
        addAll: async () => {
          throw new Error('quota');
        },
        put: async () => {},
      }),
      match: async () => undefined,
      keys: async () => [],
      delete: async () => true,
    },
    self: {
      addEventListener: (name: string, listener: (...args: never[]) => unknown) =>
        listeners.set(name, listener),
      skipWaiting: async () => {
        skipped = true;
      },
      clients: { claim: () => Promise.resolve() },
    },
  });
  let installation: Promise<unknown> | undefined;
  const install = listeners.get('install') as (event: {
    waitUntil: (value: Promise<unknown>) => void;
  }) => void;
  install({
    waitUntil: (value) => {
      installation = value;
    },
  });
  await installation;
  assert.equal(skipped, true);
});
