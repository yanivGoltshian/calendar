import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_CAMPAIGN_CHANNELS,
  allowedCampaignChannels,
  isCampaignChannel,
  normalizeChannels,
  parseCampaignChannels,
  resolveCampaignRecipients,
  type AudienceClient,
} from './channels';

test('isCampaignChannel מזהה ערוצים תקינים ופוסל אחרים', () => {
  assert.equal(isCampaignChannel('email'), true);
  assert.equal(isCampaignChannel('sms'), true);
  assert.equal(isCampaignChannel('whatsapp'), true);
  assert.equal(isCampaignChannel('all'), false);
  assert.equal(isCampaignChannel('telegram'), false);
  assert.equal(isCampaignChannel(''), false);
  assert.equal(isCampaignChannel(null), false);
  assert.equal(isCampaignChannel(42), false);
});

test('normalizeChannels מסיר כפילויות ומחזיר סדר יציב', () => {
  assert.deepEqual(normalizeChannels(['whatsapp', 'email', 'whatsapp']), ['email', 'whatsapp']);
  assert.deepEqual(normalizeChannels(['sms', 'email']), ['email', 'sms']);
});

test("normalizeChannels מרחיב 'all' לכל הערוצים", () => {
  assert.deepEqual(normalizeChannels(['all']), [...ALL_CAMPAIGN_CHANNELS]);
  // 'all' יחד עם ערוץ בודד עדיין מחזיר את כולם, פעם אחת.
  assert.deepEqual(normalizeChannels(['sms', 'all']), [...ALL_CAMPAIGN_CHANNELS]);
});

test('normalizeChannels מתעלם מרישיות, רווחים וערכים לא מוכרים', () => {
  assert.deepEqual(normalizeChannels([' Email ', 'SMS', 'bogus']), ['email', 'sms']);
  assert.deepEqual(normalizeChannels([]), []);
  assert.deepEqual(normalizeChannels(null), []);
  assert.deepEqual(normalizeChannels(undefined), []);
});

test('parseCampaignChannels נופל לאחור ל-sms עבור רשימה ריקה (תאימות לאחור)', () => {
  assert.deepEqual(parseCampaignChannels([]), ['sms']);
  assert.deepEqual(parseCampaignChannels(null), ['sms']);
  assert.deepEqual(parseCampaignChannels(['bogus']), ['sms']);
  // רשימה תקינה נשמרת כפי שהיא (מנורמלת).
  assert.deepEqual(parseCampaignChannels(['email']), ['email']);
});

const clients: AudienceClient[] = [
  { id: 'c1', name: 'עם טלפון ומייל', phone: '+972500000001', email: 'a@example.com' },
  { id: 'c2', name: 'טלפון בלבד', phone: '+972500000002', email: null },
  { id: 'c3', name: 'מייל בלבד', phone: null, email: 'c@example.com' },
  { id: 'c4', name: 'ללא ערוץ', phone: null, email: null },
];

test('resolveCampaignRecipients — מייל בלבד: רק לקוחות עם כתובת מייל', () => {
  const { messages, recipientCount } = resolveCampaignRecipients(clients, ['email']);
  assert.deepEqual(
    messages.map((m) => `${m.clientId}:${m.channel}:${m.address}`),
    ['c1:email:a@example.com', 'c3:email:c@example.com'],
  );
  assert.equal(recipientCount, 2);
});

test('resolveCampaignRecipients — sms בלבד: רק לקוחות עם טלפון', () => {
  const { messages, recipientCount } = resolveCampaignRecipients(clients, ['sms']);
  assert.deepEqual(
    messages.map((m) => `${m.clientId}:${m.channel}`),
    ['c1:sms', 'c2:sms'],
  );
  assert.equal(recipientCount, 2);
});

test('resolveCampaignRecipients — כל הערוצים: הודעה לכל צירוף לקוח×ערוץ-שמיש', () => {
  const { messages, recipientCount } = resolveCampaignRecipients(clients, ['all']);
  // c1: מייל+sms+וואטסאפ ; c2: sms+וואטסאפ ; c3: מייל ; c4: כלום
  assert.deepEqual(
    messages.map((m) => `${m.clientId}:${m.channel}`),
    [
      'c1:email',
      'c1:sms',
      'c1:whatsapp',
      'c2:sms',
      'c2:whatsapp',
      'c3:email',
    ],
  );
  // נמענים ייחודיים: c1, c2, c3 (c4 ללא ערוץ שמיש)
  assert.equal(recipientCount, 3);
});

test('resolveCampaignRecipients — רשימת ערוצים ריקה נופלת ל-sms', () => {
  const { messages, recipientCount } = resolveCampaignRecipients(clients, []);
  assert.deepEqual(
    messages.map((m) => m.channel),
    ['sms', 'sms'],
  );
  assert.equal(recipientCount, 2);
});

test('resolveCampaignRecipients — מתעלם מכתובות רווח-בלבד', () => {
  const spacey: AudienceClient[] = [
    { id: 's1', phone: '   ', email: '  ' },
    { id: 's2', phone: '+972500000009', email: '' },
  ];
  const { messages, recipientCount } = resolveCampaignRecipients(spacey, ['all']);
  assert.deepEqual(
    messages.map((m) => `${m.clientId}:${m.channel}`),
    ['s2:sms', 's2:whatsapp'],
  );
  assert.equal(recipientCount, 1);
});

test('allowedCampaignChannels — אקסקלוסיב מקבל מייל ו-SMS, אך לעולם לא וואטסאפ', () => {
  assert.deepEqual(
    allowedCampaignChannels(['email', 'sms', 'whatsapp'], { isExclusive: true }),
    ['email', 'sms'],
  );
});

test('allowedCampaignChannels — לא-אקסקלוסיב מקבל מייל בלבד', () => {
  assert.deepEqual(
    allowedCampaignChannels(['email', 'sms', 'whatsapp'], { isExclusive: false }),
    ['email'],
  );
  // קמפיין SMS-בלבד בלא-אקסקלוסיב מתרוקן (אין ערוץ מותר).
  assert.deepEqual(allowedCampaignChannels(['sms'], { isExclusive: false }), []);
});

test('allowedCampaignChannels — נפילה לאחור של קמפיין ישן (ריק) תלוית דרגה', () => {
  // רשימה ריקה => sms היסטורי; מותר רק באקסקלוסיב.
  assert.deepEqual(allowedCampaignChannels([], { isExclusive: true }), ['sms']);
  assert.deepEqual(allowedCampaignChannels([], { isExclusive: false }), []);
  assert.deepEqual(allowedCampaignChannels(null, { isExclusive: false }), []);
});

test('allowedCampaignChannels — וואטסאפ מסונן גם באקסקלוסיב וגם בלעדיו', () => {
  assert.deepEqual(allowedCampaignChannels(['whatsapp'], { isExclusive: true }), []);
  assert.deepEqual(allowedCampaignChannels(['whatsapp'], { isExclusive: false }), []);
});
