import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BRAND } from '@/config/brand';
import {
  renderMessage,
  substitute,
  escapeHtml,
  rtlShell,
  type MessageFallback,
  type OverrideLoader,
  type TemplateOverride,
} from './render';

/**
 * בדיקות התנהגות למנוע הרינדור. נתיב הדריסה נבדק עם loader מוזרק (fake) כדי לא
 * לגעת ב-DB. נתיב ה-fallback מוודא תאימות-לאחור: ללא דריסה הפלט זהה לבנאי.
 */

const NO_OVERRIDE: OverrideLoader = async () => null;
function fixedLoader(row: TemplateOverride): OverrideLoader {
  return async () => row;
}

const EMAIL_FALLBACK: MessageFallback = {
  subject: 'נושא ברירת מחדל',
  text: 'טקסט ברירת מחדל',
  html: '<!doctype html><html lang="he" dir="rtl"><body><p>עשיר</p></body></html>',
};

test('ללא businessId — מוחזר ה-fallback כפי שהוא (ה-loader אינו נקרא)', async () => {
  let called = false;
  const loader: OverrideLoader = async () => {
    called = true;
    return { body: 'לא אמור לקרות' };
  };
  const out = await renderMessage(null, 'booking_confirmation', 'email', {}, EMAIL_FALLBACK, loader);
  assert.equal(called, false);
  assert.deepEqual(out, EMAIL_FALLBACK);
});

test('אין דריסה — מוחזר ה-fallback העשיר כפי שהוא (תאימות-לאחור)', async () => {
  const out = await renderMessage('biz-1', 'booking_confirmation', 'email', {}, EMAIL_FALLBACK, NO_OVERRIDE);
  assert.deepEqual(out, EMAIL_FALLBACK);
});

test('דריסת מייל — הצבה + מעטפת RTL + נושא מהדריסה', async () => {
  const override: TemplateOverride = {
    subject: 'שלום {{clientName}}',
    body: 'הי {{clientName}}, ברוך בואך אל {{brand}}.',
  };
  const out = await renderMessage(
    'biz-1',
    'booking_confirmation',
    'email',
    { clientName: 'דנה', brand: BRAND.name },
    EMAIL_FALLBACK,
    fixedLoader(override),
  );
  assert.equal(out.text, `הי דנה, ברוך בואך אל ${BRAND.name}.`);
  assert.equal(out.subject, 'שלום דנה');
  assert.ok(out.html);
  assert.ok(out.html!.startsWith('<!doctype html><html lang="he" dir="rtl">'));
  assert.ok(out.html!.includes('הי דנה'));
});

test('דריסת מייל ללא נושא — נופל לנושא ה-fallback (מוצב)', async () => {
  const out = await renderMessage(
    'biz-1',
    'booking_confirmation',
    'email',
    { clientName: 'דנה' },
    { subject: 'ברירת מחדל ל{{clientName}}', text: 'x' },
    fixedLoader({ subject: null, body: 'גוף' }),
  );
  assert.equal(out.subject, 'ברירת מחדל לדנה');
});

test('דריסה — {{brand}} מקבל ברירת מחדל כשלא סופק ב-vars', async () => {
  const out = await renderMessage(
    'biz-1',
    'waitlist_freed',
    'email',
    { clientName: 'דנה' },
    { subject: 's', text: 't' },
    fixedLoader({ subject: 's', body: 'מ{{brand}}' }),
  );
  assert.equal(out.text, `מ${BRAND.name}`);
});

test('מציין-מיקום לא מוכר מוחלף במחרוזת ריקה', async () => {
  const out = await renderMessage(
    'biz-1',
    'booking_confirmation',
    'sms',
    { clientName: 'דנה' },
    { text: 'x' },
    fixedLoader({ body: 'הי {{clientName}}{{missing}}!' }),
  );
  assert.equal(out.text, 'הי דנה!');
});

test('דריסת מייל — HTML של הבעלים מוברח ואינו מוזרק', async () => {
  const out = await renderMessage(
    'biz-1',
    'booking_confirmation',
    'email',
    {},
    EMAIL_FALLBACK,
    fixedLoader({ subject: 'x', body: '<script>alert(1)</script>' }),
  );
  assert.ok(out.html);
  assert.ok(out.html!.includes('&lt;script&gt;'));
  assert.ok(!out.html!.includes('<script>'));
});

test('דריסת SMS — ללא נושא וללא HTML', async () => {
  const out = await renderMessage(
    'biz-1',
    'booking_confirmation',
    'sms',
    { clientName: 'דנה' },
    { text: 'ברירת מחדל' },
    fixedLoader({ body: 'הי {{clientName}}' }),
  );
  assert.equal(out.text, 'הי דנה');
  assert.equal(out.subject, undefined);
  assert.equal(out.html, undefined);
});

test('substitute — רווחים סביב השם, ערכים חסרים, וריבוי הופעות', () => {
  assert.equal(substitute('{{ a }}-{{a}}-{{b}}', { a: '1' }), '1-1-');
  assert.equal(substitute('קבוע', {}), 'קבוע');
});

test('escapeHtml — חמישה תווים', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('rtlShell — מעטפת RTL, שוברי שורה, ובריחת תווים', () => {
  const html = rtlShell('a<b>\nc');
  assert.ok(html.startsWith('<!doctype html><html lang="he" dir="rtl">'));
  assert.ok(html.includes('dir:rtl'.replace('dir:', 'direction:')));
  assert.ok(html.includes('a&lt;b&gt;<br/>c'));
});
