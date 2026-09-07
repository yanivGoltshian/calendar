import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createECDH, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ClientRequest, IncomingHttpHeaders, IncomingMessage } from 'node:http';
import type { request, RequestOptions } from 'node:https';
import webpush from 'web-push';
import { createPushProvider } from './push';
import { permittedPushEndpoint, PushResponseError, sendPinnedPush } from './pushPolicy';

const validEndpoints = [
  'https://fcm.googleapis.com/fcm/send/token',
  'https://android.googleapis.com/gcm/send/token',
  'https://updates.push.services.mozilla.com/wpush/v2/token',
  'https://web.push.apple.com/token',
  'https://wns2-db5p.notify.windows.com/w/?token=example',
];
const invalidEndpoints = [
  'https://127.0.0.1:9443/push', 'https://127.0.0.1/push', 'https://[::1]/push',
  'http://fcm.googleapis.com/fcm/send/token', 'https://169.254.169.254/metadata',
  'https://attacker.example/push', 'https://fcm.googleapis.com.attacker.example/push',
  'https://web.push.apple.com@127.0.0.1/push', 'https://fcm.googleapis.com:9443/push',
  'https://a.notify.windows.com.attacker.example/push', 'https://a.b.notify.windows.com/push',
  'https://web.push.apple.com./push', 'https://web.push.apple.com/push#fragment',
  'https://fcm.goog\tleapis.com/push', 'https://user:secret@web.push.apple.com/push',
];
const vapid = { ...webpush.generateVAPIDKeys(), subject: 'mailto:push-test@example.test' };
const receiver = createECDH('prime256v1');
receiver.generateKeys();
const keys = { p256dh: receiver.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };

function controlledTransport(statusCode = 201, headers: IncomingHttpHeaders = {}, responseBytes = 0) {
  const calls: Array<{ options: RequestOptions; body?: Buffer | string }> = [];
  const send = ((options: RequestOptions, onResponse: (response: IncomingMessage) => void) => {
    const call: (typeof calls)[number] = { options };
    calls.push(call);
    const req = new EventEmitter() as ClientRequest;
    req.end = ((body?: Buffer | string) => {
      call.body = body;
      queueMicrotask(() => {
        const stream = new PassThrough();
        const res = stream as unknown as IncomingMessage;
        res.statusCode = statusCode;
        res.headers = headers;
        onResponse(res);
        if (!res.destroyed) stream.end(Buffer.alloc(responseBytes));
      });
      return req;
    }) as ClientRequest['end'];
    return req;
  }) as typeof request;
  return { calls, request: send };
}

const publicDns = async () => [{ address: '8.8.8.8', family: 4 }];

test('push policy allows known browser services only, with HTTPS default port and no credentials', () => {
  for (const endpoint of validEndpoints) assert.ok(permittedPushEndpoint(endpoint), endpoint);
  for (const endpoint of invalidEndpoints) assert.equal(permittedPushEndpoint(endpoint), null, endpoint);
});

test('actual push provider encrypts and sends every supported service using pinned TLS transport', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const transport = controlledTransport();
  const provider = createPushProvider({
    vapid,
    subscriptions: {
      list: async (businessId) => {
        assert.equal(businessId, 'tenant-a');
        return validEndpoints.map((endpoint) => ({ endpoint, ...keys }));
      },
      remove: async () => assert.fail('healthy subscriptions must not be deleted'),
    },
    transport: { resolve: publicDns, request: transport.request },
  });
  await provider.sendToBusiness('tenant-a', 'Private title', 'Private body');
  assert.equal(transport.calls.length, validEndpoints.length);
  for (const [index, call] of transport.calls.entries()) {
    const url = new URL(validEndpoints[index]);
    assert.equal(call.options.hostname, '8.8.8.8');
    assert.equal(call.options.servername, url.hostname);
    assert.equal((call.options.headers as Record<string, unknown>).Host, url.host);
    assert.equal(call.options.rejectUnauthorized, true);
    assert.equal(call.options.agent, false);
    assert.equal(call.options.port, 443);
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.path, `${url.pathname}${url.search}`);
    assert.ok(Buffer.isBuffer(call.body));
    assert.ok(!(call.body as Buffer).includes(Buffer.from('Private body')));
    if (url.hostname !== 'android.googleapis.com') {
      assert.ok((call.options.headers as Record<string, unknown>).Authorization);
    }
  }
});

test('actual provider revalidates legacy stored endpoints before DNS or any request', async (t) => {
  t.mock.method(console, 'error', () => {});
  const provider = createPushProvider({
    vapid,
    subscriptions: {
      list: async () => invalidEndpoints.map((endpoint) => ({ endpoint, ...keys })),
      remove: async () => assert.fail('not a subscription-expiry response'),
    },
    transport: {
      resolve: async () => assert.fail('untrusted origin must not reach DNS'),
      request: (() => assert.fail('untrusted origin must never send')) as typeof request,
    },
  });
  await provider.sendToBusiness('tenant-a', 'title', 'body');
});

test('private, mixed, mapped, empty, and inconsistent DNS results fail closed', async () => {
  for (const addresses of [
    [{ address: '127.0.0.1', family: 4 }], [{ address: '10.0.0.1', family: 4 }],
    [{ address: '169.254.169.254', family: 4 }], [{ address: '192.168.1.1', family: 4 }],
    [{ address: '::1', family: 6 }], [{ address: '::ffff:127.0.0.1', family: 6 }],
    [{ address: 'fc00::1', family: 6 }], [{ address: 'fe80::1', family: 6 }],
    [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }],
    [{ address: '8.8.8.8', family: 6 }], [],
  ]) {
    await assert.rejects(sendPinnedPush({
      endpoint: validEndpoints[0], headers: {}, body: null,
    }, {
      resolve: async () => addresses,
      request: (() => assert.fail('unsafe DNS must not reach transport')) as typeof request,
    }), /push_address/);
  }
});

test('actual provider cannot send when an allowlisted hostname resolves privately', async (t) => {
  t.mock.method(console, 'error', () => {});
  const provider = createPushProvider({
    vapid,
    subscriptions: {
      list: async () => [{ endpoint: validEndpoints[0], ...keys }],
      remove: async () => assert.fail('not a subscription-expiry response'),
    },
    transport: {
      resolve: async () => [{ address: '127.0.0.1', family: 4 }],
      request: (() => assert.fail('private resolution must never send')) as typeof request,
    },
  });
  await provider.sendToBusiness('tenant-a', 'title', 'body');
});

test('DNS rebinding cannot trigger a second resolution after the checked public address', async () => {
  let resolutions = 0;
  const transport = controlledTransport();
  await sendPinnedPush({ endpoint: validEndpoints[0], headers: {}, body: null }, {
    resolve: async () => [{ address: ++resolutions === 1 ? '8.8.8.8' : '127.0.0.1', family: 4 }],
    request: transport.request,
  });
  assert.equal(resolutions, 1);
  assert.equal(transport.calls[0].options.hostname, '8.8.8.8');
  assert.equal(transport.calls[0].options.lookup, undefined, 'literal IP requires no secondary resolver');
});

test('redirects are rejected without a second request, including redirects to another trusted service', async () => {
  for (const location of ['https://127.0.0.1:9443/push', validEndpoints[1]]) {
    const transport = controlledTransport(307, { location });
    await assert.rejects(sendPinnedPush({ endpoint: validEndpoints[0], headers: {}, body: null }, {
      resolve: publicDns, request: transport.request,
    }), (error) => error instanceof PushResponseError && error.statusCode === 307);
    assert.equal(transport.calls.length, 1);
  }
});

test('push responses are size-bounded', async () => {
  const transport = controlledTransport(201, {}, 4097);
  await assert.rejects(sendPinnedPush({ endpoint: validEndpoints[0], headers: {}, body: null }, {
    resolve: publicDns, request: transport.request,
  }), /push_response_size/);
});

test('expired subscriptions are removed only within the dispatch tenant', async () => {
  const transport = controlledTransport(410);
  const removals: Array<{ businessId: string; endpoints: string[] }> = [];
  await createPushProvider({
    vapid,
    subscriptions: {
      list: async () => [{ endpoint: validEndpoints[0], ...keys }],
      remove: async (businessId, endpoints) => removals.push({ businessId, endpoints }),
    },
    transport: { resolve: publicDns, request: transport.request },
  }).sendToBusiness('tenant-a', 'title', 'body');
  assert.deepEqual(removals, [{ businessId: 'tenant-a', endpoints: [validEndpoints[0]] }]);
});
