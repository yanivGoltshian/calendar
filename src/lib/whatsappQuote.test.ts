import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeWaPhone,
  buildWhatsappLink,
  buildQuoteMessage,
  buildWhatsappQuoteLink,
  type QuoteLeadInput,
} from '@/lib/whatsappQuote';
import { CONTACT } from '@/config/contact';

const fullLead: QuoteLeadInput = {
  businessName: 'מספרת יוסי',
  planLabel: 'חבילת פרימיום',
  ownerName: 'יוסי כהן',
  phone: '050-1234567',
  email: 'yossi@example.com',
  publicPageUrl: 'https://torchick.app/b/yossi-salon',
};

test('normalizeWaPhone משאיר ספרות בלבד ומסיר את הפלוס', () => {
  assert.equal(normalizeWaPhone('+972524734788'), '972524734788');
  assert.equal(normalizeWaPhone('+972-52-473-4788'), '972524734788');
  assert.equal(normalizeWaPhone('972524734788'), '972524734788');
});

test('buildWhatsappLink בונה קישור wa.me עם טקסט מקודד', () => {
  const link = buildWhatsappLink('+972524734788', 'שלום עולם');
  assert.ok(link.startsWith('https://wa.me/972524734788?text='));
  assert.ok(link.includes(encodeURIComponent('שלום עולם')));
});

test('buildQuoteMessage כולל את כל פרטי הליד כשהם קיימים', () => {
  const msg = buildQuoteMessage(fullLead);
  assert.ok(msg.includes('מספרת יוסי'));
  assert.ok(msg.includes('חבילת פרימיום'));
  assert.ok(msg.includes('יוסי כהן'));
  assert.ok(msg.includes('050-1234567'));
  assert.ok(msg.includes('yossi@example.com'));
  assert.ok(msg.includes('https://torchick.app/b/yossi-salon'));
});

test('buildQuoteMessage משמיט שם עסק וכתובת ציבורית כשאינם קיימים', () => {
  const msg = buildQuoteMessage({
    businessName: null,
    planLabel: 'חבילה סטנדרטית',
    ownerName: 'דנה',
    phone: '052-0000000',
    email: 'dana@example.com',
    publicPageUrl: '',
  });
  assert.ok(msg.includes('חבילה סטנדרטית'));
  assert.ok(msg.includes('דנה'));
  assert.ok(!msg.includes('עמוד העסק:'));
});

test('buildWhatsappQuoteLink משתמש כברירת מחדל במספר הפלטפורמה', () => {
  const link = buildWhatsappQuoteLink(fullLead);
  const expectedPhone = normalizeWaPhone(CONTACT.PHONE_E164);
  assert.ok(link.startsWith(`https://wa.me/${expectedPhone}?text=`));
  const decoded = decodeURIComponent(link.split('text=')[1]);
  assert.ok(decoded.includes('מספרת יוסי'));
  assert.ok(decoded.includes('yossi@example.com'));
});

test('buildWhatsappQuoteLink מאפשר דריסת מספר לצורכי בדיקה', () => {
  const link = buildWhatsappQuoteLink(fullLead, '+14155550123');
  assert.ok(link.startsWith('https://wa.me/14155550123?text='));
});
