import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveMessagingProvider,
  MessagingConfigError,
  MessagingSendError,
  buildOtpMessage,
  ConsoleMessagingProvider,
  WhatsAppCloudProvider,
  type WhatsAppCloudConfig,
  Sms4FreeProvider,
  parseSms4FreeBody,
  sms4freeErrorMessage,
  type Sms4FreeConfig,
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

/** קונפיג בסיסי ל-WhatsAppCloudProvider בבדיקות. */
function baseConfig(overrides: Partial<WhatsAppCloudConfig> = {}): WhatsAppCloudConfig {
  return {
    phoneNumberId: '111222333',
    accessToken: 'secret-token',
    otpTemplate: 'torchick_otp',
    otpTemplateLang: 'he',
    otpButtonSubType: 'url',
    graphVersion: 'v21.0',
    baseUrl: 'https://graph.facebook.com',
    defaultCountryCode: '972',
    ...overrides,
  };
}

// ---------- בחירת ספק ----------

test('ברירת מחדל: console כשאין MESSAGING_PROVIDER (לא בפרודקשן)', () => {
  const provider = resolveMessagingProvider({ NODE_ENV: 'development' });
  assert.ok(provider instanceof ConsoleMessagingProvider);
  assert.equal(provider.name, 'console');
});

test('console בפרודקשן זורק MessagingConfigError (כשל רועש)', () => {
  assert.throws(
    () => resolveMessagingProvider({ NODE_ENV: 'production', MESSAGING_PROVIDER: 'console' }),
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
    () => resolveMessagingProvider({ MESSAGING_PROVIDER: 'carrier-pigeon' }),
    MessagingConfigError,
  );
});

test('MESSAGING_PROVIDER גובר על SMS_PROVIDER', () => {
  // SMS_PROVIDER=console אך MESSAGING_PROVIDER=whatsapp-cloud עם קרדנשלס תקינים.
  const provider = resolveMessagingProvider({
    SMS_PROVIDER: 'console',
    MESSAGING_PROVIDER: 'whatsapp-cloud',
    WHATSAPP_PHONE_NUMBER_ID: '111',
    WHATSAPP_ACCESS_TOKEN: 'tok',
    WHATSAPP_OTP_TEMPLATE: 'torchick_otp',
  });
  assert.ok(provider instanceof WhatsAppCloudProvider);
  assert.equal(provider.name, 'whatsapp-cloud');
});

test('תאימות לאחור: SMS_PROVIDER=whatsapp-cloud עדיין נבחר', () => {
  const provider = resolveMessagingProvider({
    SMS_PROVIDER: 'whatsapp-cloud',
    WHATSAPP_PHONE_NUMBER_ID: '111',
    WHATSAPP_ACCESS_TOKEN: 'tok',
    WHATSAPP_OTP_TEMPLATE: 'torchick_otp',
  });
  assert.ok(provider instanceof WhatsAppCloudProvider);
});

test('alias של whatsapp נבחר גם הוא', () => {
  const provider = resolveMessagingProvider({
    MESSAGING_PROVIDER: 'whatsapp',
    WHATSAPP_PHONE_NUMBER_ID: '111',
    WHATSAPP_ACCESS_TOKEN: 'tok',
    WHATSAPP_OTP_TEMPLATE: 'torchick_otp',
  });
  assert.ok(provider instanceof WhatsAppCloudProvider);
});

// ---------- whatsapp-cloud: תצורה ----------

test('whatsapp-cloud ללא קרדנשלס זורק MessagingConfigError ומפרט חוסרים', () => {
  assert.throws(
    () => resolveMessagingProvider({ MESSAGING_PROVIDER: 'whatsapp-cloud' }),
    (err: unknown) => {
      assert.ok(err instanceof MessagingConfigError);
      assert.ok((err as Error).message.includes('WHATSAPP_PHONE_NUMBER_ID'));
      assert.ok((err as Error).message.includes('WHATSAPP_ACCESS_TOKEN'));
      assert.ok((err as Error).message.includes('WHATSAPP_OTP_TEMPLATE'));
      return true;
    },
  );
});

test('whatsapp-cloud עם קרדנשלס חלקיים זורק (חסר תבנית)', () => {
  assert.throws(
    () =>
      resolveMessagingProvider({
        MESSAGING_PROVIDER: 'whatsapp-cloud',
        WHATSAPP_PHONE_NUMBER_ID: '111',
        WHATSAPP_ACCESS_TOKEN: 'tok',
      }),
    MessagingConfigError,
  );
});

// ---------- whatsapp-cloud: שליחה ----------

test('sendOtp שולח תבנית authentication עם URL, Bearer, וקוד בגוף ובכפתור', async () => {
  const calls: RecordedCall[] = [];
  const provider = new WhatsAppCloudProvider(baseConfig(), fakeFetch(calls));

  await provider.sendOtp('+972541111111', '123456');

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://graph.facebook.com/v21.0/111222333/messages',
  );
  assert.equal(headerValue(calls[0].init, 'Authorization'), 'Bearer secret-token');
  assert.equal(headerValue(calls[0].init, 'Content-Type'), 'application/json');

  const payload = JSON.parse(String(calls[0].init?.body));
  assert.equal(payload.messaging_product, 'whatsapp');
  assert.equal(payload.to, '972541111111');
  assert.equal(payload.type, 'template');
  assert.equal(payload.template.name, 'torchick_otp');
  assert.equal(payload.template.language.code, 'he');

  const body = payload.template.components.find((c: { type: string }) => c.type === 'body');
  assert.equal(body.parameters[0].text, '123456');
  const button = payload.template.components.find((c: { type: string }) => c.type === 'button');
  assert.equal(button.sub_type, 'url');
  assert.equal(button.index, '0');
  assert.equal(button.parameters[0].text, '123456');
});

test('sendOtp ללא כפתור (subtype=null) משמיט את רכיב הכפתור', async () => {
  const calls: RecordedCall[] = [];
  const provider = new WhatsAppCloudProvider(
    baseConfig({ otpButtonSubType: null }),
    fakeFetch(calls),
  );

  await provider.sendOtp('+972541111111', '654321');

  const payload = JSON.parse(String(calls[0].init?.body));
  const button = payload.template.components.find((c: { type: string }) => c.type === 'button');
  assert.equal(button, undefined);
  assert.equal(payload.template.components.length, 1);
});

test('sendWhatsApp שולח הודעת טקסט חופשי', async () => {
  const calls: RecordedCall[] = [];
  const provider = new WhatsAppCloudProvider(baseConfig(), fakeFetch(calls));

  await provider.sendWhatsApp('+972541111111', 'שלום');

  const payload = JSON.parse(String(calls[0].init?.body));
  assert.equal(payload.type, 'text');
  assert.equal(payload.text.body, 'שלום');
  assert.equal(payload.text.preview_url, false);
  assert.equal(payload.to, '972541111111');
});

test('sendSms מאציל ל-WhatsApp (אין ערוץ SMS בתשלום)', async () => {
  const calls: RecordedCall[] = [];
  const provider = new WhatsAppCloudProvider(baseConfig(), fakeFetch(calls));

  await provider.sendSms('+972541111111', 'הודעה');

  const payload = JSON.parse(String(calls[0].init?.body));
  assert.equal(payload.type, 'text');
  assert.equal(payload.text.body, 'הודעה');
});

test('נורמליזציה: מספר מקומי 0... הופך לקידומת מדינה', async () => {
  const calls: RecordedCall[] = [];
  const provider = new WhatsAppCloudProvider(baseConfig(), fakeFetch(calls));

  await provider.sendWhatsApp('0541111111', 'x');

  const payload = JSON.parse(String(calls[0].init?.body));
  assert.equal(payload.to, '972541111111');
});

test('תגובת שגיאה מ-Graph זורקת MessagingSendError', async () => {
  const calls: RecordedCall[] = [];
  const provider = new WhatsAppCloudProvider(baseConfig(), fakeFetch(calls, 401, 'unauthorized'));

  await assert.rejects(() => provider.sendOtp('+972541111111', '123456'), MessagingSendError);
});

// ---------- הודעת OTP ----------

test('buildOtpMessage כולל את שם המותג ואת הקוד', () => {
  const msg = buildOtpMessage('123456');
  assert.ok(msg.includes('123456'));
  assert.ok(msg.includes(BRAND.name));
});

// ---------- sms4free: תצורה ----------

/** קונפיג בסיסי ל-Sms4FreeProvider בבדיקות. */
function sms4freeConfig(overrides: Partial<Sms4FreeConfig> = {}): Sms4FreeConfig {
  return {
    apiKey: 'api-key-secret',
    user: '0501234567',
    pass: 'pass-secret',
    sender: 'Torchick',
    baseUrl: 'https://api.sms4free.co.il',
    sendPath: '/ApiSMS/v2/SendSMS',
    defaultCountryCode: '972',
    ...overrides,
  };
}

test('sms4free עם קרדנשלס מלאים נבחר ומחזיר Sms4FreeProvider', () => {
  const provider = resolveMessagingProvider({
    MESSAGING_PROVIDER: 'sms4free',
    SMS4FREE_API_KEY: 'k',
    SMS4FREE_USER: '0501234567',
    SMS4FREE_PASS: 'p',
    SMS4FREE_SENDER: 'Torchick',
  });
  assert.ok(provider instanceof Sms4FreeProvider);
  assert.equal(provider.name, 'sms4free');
});

test('alias של sms-il נבחר גם הוא', () => {
  const provider = resolveMessagingProvider({
    MESSAGING_PROVIDER: 'sms-il',
    SMS4FREE_API_KEY: 'k',
    SMS4FREE_USER: '0501234567',
    SMS4FREE_PASS: 'p',
    SMS4FREE_SENDER: 'Torchick',
  });
  assert.ok(provider instanceof Sms4FreeProvider);
});

test('sms4free ללא קרדנשלס זורק MessagingConfigError ומפרט חוסרים', () => {
  assert.throws(
    () => resolveMessagingProvider({ MESSAGING_PROVIDER: 'sms4free' }),
    (err: unknown) => {
      assert.ok(err instanceof MessagingConfigError);
      const message = (err as Error).message;
      assert.ok(message.includes('SMS4FREE_API_KEY'));
      assert.ok(message.includes('SMS4FREE_USER'));
      assert.ok(message.includes('SMS4FREE_PASS'));
      assert.ok(message.includes('SMS4FREE_SENDER'));
      return true;
    },
  );
});

// ---------- sms4free: שליחה ----------

test('sendSms שולח POST עם JSON תקין ונמען מנורמל למבנה מקומי', async () => {
  const calls: RecordedCall[] = [];
  const provider = new Sms4FreeProvider(sms4freeConfig(), fakeFetch(calls, 200, '1'));

  await provider.sendSms('+972541111111', 'שלום עולם');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.sms4free.co.il/ApiSMS/v2/SendSMS');
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(
    headerValue(calls[0].init, 'Content-Type'),
    'application/json; charset=utf-8',
  );

  const payload = JSON.parse(String(calls[0].init?.body));
  assert.equal(payload.key, 'api-key-secret');
  assert.equal(payload.user, '0501234567');
  assert.equal(payload.pass, 'pass-secret');
  assert.equal(payload.sender, 'Torchick');
  assert.equal(payload.recipient, '0541111111');
  assert.equal(payload.msg, 'שלום עולם');
});

test('sendSmsWithResult מחזיר את מזהה ההודעה מתגובת v2', async () => {
  const calls: RecordedCall[] = [];
  const provider = new Sms4FreeProvider(
    sms4freeConfig(),
    fakeFetch(calls, 200, JSON.stringify({ status: 1, id: 'abc123' })),
  );

  const result = await provider.sendSmsWithResult('0541111111', 'הודעה');

  assert.equal(result.ok, true);
  assert.equal(result.providerMessageId, 'abc123');
});

test('sendSmsWithResult מקבל תגובת v1 של מספר שלם כטקסט', async () => {
  const calls: RecordedCall[] = [];
  const provider = new Sms4FreeProvider(sms4freeConfig(), fakeFetch(calls, 200, '1'));

  const result = await provider.sendSmsWithResult('0541111111', 'הודעה');

  assert.equal(result.ok, true);
  assert.equal(result.code, 1);
});

test('קוד שגיאה שלילי מהשער זורק MessagingSendError', async () => {
  const calls: RecordedCall[] = [];
  const provider = new Sms4FreeProvider(sms4freeConfig(), fakeFetch(calls, 200, '-4'));

  await assert.rejects(() => provider.sendSms('0541111111', 'הודעה'), MessagingSendError);
});

test('תגובת HTTP שאינה 2xx זורקת MessagingSendError', async () => {
  const calls: RecordedCall[] = [];
  const provider = new Sms4FreeProvider(
    sms4freeConfig(),
    fakeFetch(calls, 500, 'server error'),
  );

  await assert.rejects(() => provider.sendSms('0541111111', 'הודעה'), MessagingSendError);
});

test('sendOtp שולח מסרון עם שם המותג והקוד', async () => {
  const calls: RecordedCall[] = [];
  const provider = new Sms4FreeProvider(sms4freeConfig(), fakeFetch(calls, 200, '1'));

  await provider.sendOtp('0541111111', '246810');

  const payload = JSON.parse(String(calls[0].init?.body));
  assert.ok(payload.msg.includes('246810'));
  assert.ok(payload.msg.includes(BRAND.name));
});

test('נרמול נמען: קידומת בין-לאומית +972 הופכת ל-0', async () => {
  const calls: RecordedCall[] = [];
  const provider = new Sms4FreeProvider(sms4freeConfig(), fakeFetch(calls, 200, '1'));

  await provider.sendSms('+972541111111', 'x');

  const payload = JSON.parse(String(calls[0].init?.body));
  assert.equal(payload.recipient, '0541111111');
});

test('נרמול נמען: קידומת 00 בין-לאומית מנוקה', async () => {
  const calls: RecordedCall[] = [];
  const provider = new Sms4FreeProvider(sms4freeConfig(), fakeFetch(calls, 200, '1'));

  await provider.sendSms('00972541111111', 'x');

  const payload = JSON.parse(String(calls[0].init?.body));
  assert.equal(payload.recipient, '0541111111');
});

// ---------- sms4free: פענוח גוף התגובה ----------

test('parseSms4FreeBody מזהה מספר שלם חיובי כהצלחה', () => {
  const result = parseSms4FreeBody('3');
  assert.equal(result.ok, true);
  assert.equal(result.code, 3);
});

test('parseSms4FreeBody מזהה אובייקט v2 עם status ו-id', () => {
  const result = parseSms4FreeBody(JSON.stringify({ status: 1, id: 'm-9' }));
  assert.equal(result.ok, true);
  assert.equal(result.providerMessageId, 'm-9');
});

test('parseSms4FreeBody מזהה קוד שלילי כשגיאה עם טקסט עברי', () => {
  const result = parseSms4FreeBody('-1');
  assert.equal(result.ok, false);
  assert.equal(result.code, -1);
  assert.ok((result.error ?? '').length > 0);
});

test('parseSms4FreeBody מחזיר שגיאה על תגובה לא צפויה', () => {
  const result = parseSms4FreeBody('לא מספר');
  assert.equal(result.ok, false);
});

test('sms4freeErrorMessage ממפה קודים ידועים ולא ידועים', () => {
  assert.equal(sms4freeErrorMessage(-4), 'יתרת ההודעות נמוכה מכדי לשלוח');
  assert.ok(sms4freeErrorMessage(-99).includes('-99'));
});
