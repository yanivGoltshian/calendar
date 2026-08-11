import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveMessagingProvider,
  MessagingConfigError,
  MessagingSendError,
  buildOtpMessage,
  ConsoleMessagingProvider,
  TwilioMessagingProvider,
  HttpGatewayMessagingProvider,
} from './messaging';
import { BRAND } from '@/config/brand';

// ---------- עוזרי בדיקה ----------

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

/** fetch מזויף שמתעד קריאות ומחזיר תשובה עם סטטוס נתון. */
function fakeFetch(calls: RecordedCall[], status = 200, body = ''): typeof fetch {
  return (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
}

function headerValue(init: RequestInit | undefined, name: string): string | undefined {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return headers[name];
}

// ---------- בחירת ספק ----------

test('ברירת מחדל: console כשאין SMS_PROVIDER (לא בפרודקשן)', () => {
  const provider = resolveMessagingProvider({ NODE_ENV: 'development' });
  assert.ok(provider instanceof ConsoleMessagingProvider);
  assert.equal(provider.name, 'console');
});

test('console בפרודקשן זורק MessagingConfigError (כשל רועש)', () => {
  assert.throws(
    () => resolveMessagingProvider({ NODE_ENV: 'production', SMS_PROVIDER: 'console' }),
    MessagingConfigError,
  );
});

test('console ריק בפרודקשן זורק MessagingConfigError', () => {
  assert.throws(
    () => resolveMessagingProvider({ NODE_ENV: 'production' }),
    MessagingConfigError,
  );
});

test('ספק לא מוכר זורק MessagingConfigError', () => {
  assert.throws(
    () => resolveMessagingProvider({ SMS_PROVIDER: 'carrier-pigeon' }),
    MessagingConfigError,
  );
});

// ---------- Twilio ----------

test('twilio ללא קרדנשלס זורק MessagingConfigError', () => {
  assert.throws(
    () => resolveMessagingProvider({ SMS_PROVIDER: 'twilio' }),
    MessagingConfigError,
  );
});

test('twilio עם SID+טוקן אך ללא service/from זורק MessagingConfigError', () => {
  assert.throws(
    () =>
      resolveMessagingProvider({
        SMS_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'ACxxx',
        TWILIO_AUTH_TOKEN: 'tok',
      }),
    MessagingConfigError,
  );
});

test('twilio עם from תקין מחזיר ספק twilio', () => {
  const provider = resolveMessagingProvider({
    SMS_PROVIDER: 'twilio',
    TWILIO_ACCOUNT_SID: 'ACxxx',
    TWILIO_AUTH_TOKEN: 'tok',
    TWILIO_FROM: '+972500000000',
  });
  assert.ok(provider instanceof TwilioMessagingProvider);
  assert.equal(provider.name, 'twilio');
});

test('twilio sendSms קורא ל-REST עם auth ו-body נכונים', async () => {
  const calls: RecordedCall[] = [];
  const provider = new TwilioMessagingProvider(
    { accountSid: 'ACxxx', authToken: 'secret', from: '+972500000000' },
    fakeFetch(calls),
  );

  await provider.sendSms('+972541111111', 'שלום');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages.json');
  const auth = headerValue(calls[0].init, 'Authorization');
  assert.equal(auth, `Basic ${Buffer.from('ACxxx:secret').toString('base64')}`);
  const params = new URLSearchParams(String(calls[0].init?.body));
  assert.equal(params.get('To'), '+972541111111');
  assert.equal(params.get('From'), '+972500000000');
  assert.equal(params.get('Body'), 'שלום');
});

test('twilio sendWhatsApp מוסיף קידומת whatsapp:', async () => {
  const calls: RecordedCall[] = [];
  const provider = new TwilioMessagingProvider(
    { accountSid: 'ACxxx', authToken: 'secret', from: '+972500000000' },
    fakeFetch(calls),
  );

  await provider.sendWhatsApp('+972541111111', 'hi');

  const params = new URLSearchParams(String(calls[0].init?.body));
  assert.equal(params.get('To'), 'whatsapp:+972541111111');
  assert.equal(params.get('From'), 'whatsapp:+972500000000');
});

test('twilio זורק MessagingSendError כשה-REST מחזיר שגיאה', async () => {
  const calls: RecordedCall[] = [];
  const provider = new TwilioMessagingProvider(
    { accountSid: 'ACxxx', authToken: 'secret', from: '+972500000000' },
    fakeFetch(calls, 400, 'bad'),
  );

  await assert.rejects(() => provider.sendSms('+972541111111', 'x'), MessagingSendError);
});

// ---------- שער HTTP ----------

test('httpgateway ללא endpoint זורק MessagingConfigError', () => {
  assert.throws(
    () => resolveMessagingProvider({ SMS_PROVIDER: 'httpgateway' }),
    MessagingConfigError,
  );
});

test('httpgateway עם endpoint מחזיר ספק httpgateway', () => {
  const provider = resolveMessagingProvider({
    SMS_PROVIDER: 'httpgateway',
    SMS_GATEWAY_ENDPOINT: 'https://gw.example.com/send',
  });
  assert.ok(provider instanceof HttpGatewayMessagingProvider);
  assert.equal(provider.name, 'httpgateway');
});

test('httpgateway basic ללא username/password זורק MessagingConfigError', () => {
  assert.throws(
    () =>
      resolveMessagingProvider({
        SMS_PROVIDER: 'httpgateway',
        SMS_GATEWAY_ENDPOINT: 'https://gw.example.com/send',
        SMS_GATEWAY_AUTH_MODE: 'basic',
      }),
    MessagingConfigError,
  );
});

test('httpgateway preset לא מוכר זורק MessagingConfigError', () => {
  assert.throws(
    () =>
      resolveMessagingProvider({
        SMS_PROVIDER: 'httpgateway',
        SMS_GATEWAY_PRESET: 'nope',
        SMS_GATEWAY_ENDPOINT: 'https://gw.example.com/send',
      }),
    MessagingConfigError,
  );
});

test('httpgateway sendSms שולח JSON עם שדות ברירת המחדל', async () => {
  const calls: RecordedCall[] = [];
  const provider = resolveMessagingProvider(
    {
      SMS_PROVIDER: 'httpgateway',
      SMS_GATEWAY_ENDPOINT: 'https://gw.example.com/send',
      SMS_GATEWAY_FROM: 'Torchick',
    },
    fakeFetch(calls),
  );

  await provider.sendSms('0541111111', 'קוד');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://gw.example.com/send');
  const payload = JSON.parse(String(calls[0].init?.body));
  assert.equal(payload.to, '0541111111');
  assert.equal(payload.text, 'קוד');
  assert.equal(payload.from, 'Torchick');
});

test('httpgateway אינו תומך ב-WhatsApp', async () => {
  const provider = new HttpGatewayMessagingProvider(
    {
      endpoint: 'https://gw.example.com/send',
      method: 'POST',
      authMode: 'none',
      authHeader: 'Authorization',
      toField: 'to',
      textField: 'text',
      fromField: 'from',
      extra: {},
    },
    fakeFetch([]),
  );

  await assert.rejects(() => provider.sendWhatsApp('+972541111111', 'x'), MessagingConfigError);
});

test('httpgateway SMS_GATEWAY_EXTRA_JSON לא תקין זורק MessagingConfigError', () => {
  assert.throws(
    () =>
      resolveMessagingProvider({
        SMS_PROVIDER: 'httpgateway',
        SMS_GATEWAY_ENDPOINT: 'https://gw.example.com/send',
        SMS_GATEWAY_EXTRA_JSON: '{not-json',
      }),
    MessagingConfigError,
  );
});

// ---------- הודעת OTP ----------

test('buildOtpMessage כולל את שם המותג ואת הקוד', () => {
  const msg = buildOtpMessage('123456');
  assert.ok(msg.includes('123456'));
  assert.ok(msg.includes(BRAND.name));
});
