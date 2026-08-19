import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deliverCampaignMessage,
  getCampaignDeliveryStatus,
  type CampaignDeliveryDeps,
} from './delivery';

test('getCampaignDeliveryStatus — סביבה ריקה: מצב פיתוח, אין ערוץ חי', () => {
  const status = getCampaignDeliveryStatus({});
  assert.deepEqual(status, { email: false, sms: false, whatsapp: false, anyLive: false });
});

test("getCampaignDeliveryStatus — MESSAGING_PROVIDER=console נחשב פיתוח", () => {
  const status = getCampaignDeliveryStatus({ MESSAGING_PROVIDER: 'console' });
  assert.equal(status.sms, false);
  assert.equal(status.whatsapp, false);
  assert.equal(status.anyLive, false);
});

test('getCampaignDeliveryStatus — ספק וואטסאפ חי מפעיל sms ווואטסאפ', () => {
  const status = getCampaignDeliveryStatus({ MESSAGING_PROVIDER: 'whatsapp-cloud' });
  assert.equal(status.sms, true);
  assert.equal(status.whatsapp, true);
  assert.equal(status.email, false);
  assert.equal(status.anyLive, true);
});

test('getCampaignDeliveryStatus — נופל ל-SMS_PROVIDER כשאין MESSAGING_PROVIDER', () => {
  const status = getCampaignDeliveryStatus({ SMS_PROVIDER: 'whatsapp' });
  assert.equal(status.whatsapp, true);
  assert.equal(status.sms, true);
});

test('getCampaignDeliveryStatus — מייל חי דורש EMAIL_SERVER וגם EMAIL_FROM', () => {
  assert.equal(getCampaignDeliveryStatus({ EMAIL_SERVER: 'smtp://x' }).email, false);
  assert.equal(getCampaignDeliveryStatus({ EMAIL_FROM: 'a@b.co' }).email, false);
  const both = getCampaignDeliveryStatus({ EMAIL_SERVER: 'smtp://x', EMAIL_FROM: 'a@b.co' });
  assert.equal(both.email, true);
  assert.equal(both.anyLive, true);
});

test('getCampaignDeliveryStatus — מתעלם מרישיות ורווחים בבחירת הספק', () => {
  const status = getCampaignDeliveryStatus({ MESSAGING_PROVIDER: '  WhatsApp-Cloud  ' });
  assert.equal(status.whatsapp, true);
});

function trackingDeps(): { deps: CampaignDeliveryDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: CampaignDeliveryDeps = {
    sendEmail: async (to, subject, text) => {
      calls.push(`email|${to}|${subject}|${text}`);
    },
    sendSms: async (to, message) => {
      calls.push(`sms|${to}|${message}`);
    },
    sendWhatsApp: async (to, message) => {
      calls.push(`whatsapp|${to}|${message}`);
    },
  };
  return { deps, calls };
}

test('deliverCampaignMessage — ערוץ מייל מנתב ל-sendEmail עם נושא', async () => {
  const { deps, calls } = trackingDeps();
  await deliverCampaignMessage('email', 'a@example.com', 'גוף ההודעה', {
    subject: 'מבצע',
    deps,
  });
  assert.deepEqual(calls, ['email|a@example.com|מבצע|גוף ההודעה']);
});

test('deliverCampaignMessage — ערוץ sms מנתב ל-sendSms', async () => {
  const { deps, calls } = trackingDeps();
  await deliverCampaignMessage('sms', '+972500000001', 'שלום', { deps });
  assert.deepEqual(calls, ['sms|+972500000001|שלום']);
});

test('deliverCampaignMessage — ערוץ וואטסאפ מנתב ל-sendWhatsApp', async () => {
  const { deps, calls } = trackingDeps();
  await deliverCampaignMessage('whatsapp', '+972500000002', 'היי', { deps });
  assert.deepEqual(calls, ['whatsapp|+972500000002|היי']);
});

test('deliverCampaignMessage — כשל ספק מתפשט לקורא', async () => {
  const deps: CampaignDeliveryDeps = {
    sendEmail: async () => {
      throw new Error('SMTP down');
    },
    sendSms: async () => {},
    sendWhatsApp: async () => {},
  };
  await assert.rejects(
    () => deliverCampaignMessage('email', 'a@example.com', 'x', { deps }),
    /SMTP down/,
  );
});
