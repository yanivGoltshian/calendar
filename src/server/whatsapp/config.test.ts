import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadWhatsAppConfig,
  rateForType,
  templateForType,
  transportAvailable,
  liveSendingEnabled,
  DEFAULT_UTILITY_RATE_AGOROT,
  DEFAULT_WARN_AGOROT,
  DEFAULT_BLOCK_AGOROT,
  DEFAULT_SUPER_ADMIN_EMAIL,
} from '@/server/whatsapp/config';

test('loadWhatsAppConfig מחזיר ברירות מחדל כשאין משתני סביבה', () => {
  const c = loadWhatsAppConfig({});
  assert.equal(c.connectionString, undefined);
  assert.equal(c.channelId, undefined);
  assert.equal(c.templates.otp, undefined);
  assert.equal(c.templateLang, 'he');
  assert.equal(c.rates.utility, DEFAULT_UTILITY_RATE_AGOROT);
  assert.equal(c.rates.auth, DEFAULT_UTILITY_RATE_AGOROT);
  assert.equal(c.rates.marketing, DEFAULT_UTILITY_RATE_AGOROT);
  assert.equal(c.warnAgorot, DEFAULT_WARN_AGOROT);
  assert.equal(c.blockAgorot, DEFAULT_BLOCK_AGOROT);
  assert.equal(c.superAdminEmail, DEFAULT_SUPER_ADMIN_EMAIL);
});

test('loadWhatsAppConfig קורא ומנרמל משתני סביבה', () => {
  const c = loadWhatsAppConfig({
    ACS_CONNECTION_STRING: '  endpoint=https://x;accesskey=k  ',
    ACS_WHATSAPP_CHANNEL_ID: 'chan-123',
    WA_TEMPLATE_OTP: 'otp_he',
    WA_TEMPLATE_CONFIRM: 'confirm_he',
    WA_TEMPLATE_REMINDER: 'reminder_he',
    WA_TEMPLATE_LANG: 'en_US',
    WHATSAPP_UTILITY_RATE_AGOROT: '15',
    WHATSAPP_MONTHLY_WARN_AGOROT: '5000',
    WHATSAPP_MONTHLY_BLOCK_AGOROT: '6000',
    SUPER_ADMIN_EMAIL: 'boss@example.com',
  });
  assert.equal(c.connectionString, 'endpoint=https://x;accesskey=k');
  assert.equal(c.channelId, 'chan-123');
  assert.equal(c.templates.confirm, 'confirm_he');
  assert.equal(c.templateLang, 'en_US');
  assert.equal(c.rates.utility, 15);
  // auth/marketing נופלים לתעריף ה-utility כשלא הוגדרו במפורש.
  assert.equal(c.rates.auth, 15);
  assert.equal(c.rates.marketing, 15);
  assert.equal(c.warnAgorot, 5000);
  assert.equal(c.blockAgorot, 6000);
  assert.equal(c.superAdminEmail, 'boss@example.com');
});

test('תעריפי auth/marketing מפורשים גוברים על utility', () => {
  const c = loadWhatsAppConfig({
    WHATSAPP_UTILITY_RATE_AGOROT: '12',
    WHATSAPP_AUTH_RATE_AGOROT: '30',
    WHATSAPP_MARKETING_RATE_AGOROT: '50',
  });
  assert.equal(c.rates.utility, 12);
  assert.equal(c.rates.auth, 30);
  assert.equal(c.rates.marketing, 50);
});

test('ערכי אגורות לא תקינים נופלים לברירת מחדל', () => {
  const c = loadWhatsAppConfig({
    WHATSAPP_UTILITY_RATE_AGOROT: 'abc',
    WHATSAPP_MONTHLY_WARN_AGOROT: '-5',
    WHATSAPP_MONTHLY_BLOCK_AGOROT: '',
  });
  assert.equal(c.rates.utility, DEFAULT_UTILITY_RATE_AGOROT);
  assert.equal(c.warnAgorot, DEFAULT_WARN_AGOROT);
  assert.equal(c.blockAgorot, DEFAULT_BLOCK_AGOROT);
});

test('superAdminEmail נופל לכתובת הראשונה ב-PLATFORM_ADMIN_EMAILS ואז לברירת מחדל', () => {
  const withList = loadWhatsAppConfig({ PLATFORM_ADMIN_EMAILS: 'a@x.com, b@x.com' });
  assert.equal(withList.superAdminEmail, 'a@x.com');
  const none = loadWhatsAppConfig({});
  assert.equal(none.superAdminEmail, DEFAULT_SUPER_ADMIN_EMAIL);
});

test('rateForType ממפה סוג הודעה לתעריף', () => {
  const c = loadWhatsAppConfig({
    WHATSAPP_UTILITY_RATE_AGOROT: '12',
    WHATSAPP_AUTH_RATE_AGOROT: '30',
    WHATSAPP_MARKETING_RATE_AGOROT: '50',
  });
  assert.equal(rateForType(c, 'OTP'), 30);
  assert.equal(rateForType(c, 'CONFIRMATION'), 12);
  assert.equal(rateForType(c, 'REMINDER'), 12);
  assert.equal(rateForType(c, 'CAMPAIGN'), 50);
});

test('templateForType ממפה סוג הודעה לשם התבנית', () => {
  const c = loadWhatsAppConfig({
    WA_TEMPLATE_OTP: 'otp_he',
    WA_TEMPLATE_CONFIRM: 'confirm_he',
    WA_TEMPLATE_REMINDER: 'reminder_he',
  });
  assert.equal(templateForType(c, 'OTP'), 'otp_he');
  assert.equal(templateForType(c, 'CONFIRMATION'), 'confirm_he');
  assert.equal(templateForType(c, 'REMINDER'), 'reminder_he');
  assert.equal(templateForType(c, 'CAMPAIGN'), undefined);
});

test('transportAvailable ו-liveSendingEnabled משקפים את השער', () => {
  assert.equal(transportAvailable(loadWhatsAppConfig({})), false);
  const connOnly = loadWhatsAppConfig({ ACS_CONNECTION_STRING: 'c' });
  assert.equal(transportAvailable(connOnly), true);
  assert.equal(liveSendingEnabled(connOnly), false);
  const full = loadWhatsAppConfig({ ACS_CONNECTION_STRING: 'c', ACS_WHATSAPP_CHANNEL_ID: 'ch' });
  assert.equal(liveSendingEnabled(full), true);
});
