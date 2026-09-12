import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BRAND } from './registry';
import {
  fillBusinessTokens,
  previewTemplate,
  type BusinessTemplateContext,
} from './businessTokens';

/**
 * מילוי משתני-העסק: משתני-עסק נפתרים בעורך, משתני התור-הבודד נשארים סוגריים,
 * והתצוגה המקדימה תמיד נטולת סוגריים.
 */

const ctx: BusinessTemplateContext = {
  businessName: 'מספרת הדר',
  businessPhone: '03-1234567',
  businessAddress: 'הרצל 10, תל אביב',
};

test('fillBusinessTokens ממלא את משתני-העסק בערכים אמיתיים', () => {
  const out = fillBusinessTokens(
    'שלום, כאן {{businessName}}. טלפון: {{businessPhone}} · כתובת: {{businessAddress}}',
    ctx,
  );
  assert.equal(out, 'שלום, כאן מספרת הדר. טלפון: 03-1234567 · כתובת: הרצל 10, תל אביב');
});

test('fillBusinessTokens משאיר את משתני התור-הבודד כפלייסהולדר', () => {
  const out = fillBusinessTokens(
    '{{businessName}}: שלום {{clientName}}, התור ל-{{date}} · {{time}}',
    ctx,
  );
  assert.equal(out, 'מספרת הדר: שלום {{clientName}}, התור ל-{{date}} · {{time}}');
});

test('fillBusinessTokens: brand תמיד נפתר לברירת-מחדל גם ללא ערך', () => {
  const out = fillBusinessTokens('{{brand}} · {{businessName}}', ctx);
  assert.equal(out, `${DEFAULT_BRAND} · מספרת הדר`);
});

test('fillBusinessTokens: משתנה-עסק ריק נשאר כפלייסהולדר (לא שורה חסרת-ערך)', () => {
  const out = fillBusinessTokens('טלפון: {{businessPhone}}', {
    businessName: 'עסק',
    businessPhone: '  ',
  });
  assert.equal(out, 'טלפון: {{businessPhone}}');
});

test('fillBusinessTokens: רווחים בתוך הסוגריים עדיין נפתרים', () => {
  const out = fillBusinessTokens('{{ businessName }}', ctx);
  assert.equal(out, 'מספרת הדר');
});

test('previewTemplate מייצר תצוגה נטולת סוגריים לחלוטין', () => {
  const preview = previewTemplate(
    '{{brand}}: שלום {{clientName}}, התור שלך ב{{businessName}} ל-{{date}} · {{time}}. {{unknownToken}}',
    ctx,
  );
  assert.ok(!preview.includes('{{'), 'התצוגה אינה מכילה סוגריים פתוחים');
  assert.ok(!preview.includes('}}'), 'התצוגה אינה מכילה סוגריים סוגרים');
  assert.ok(preview.includes('מספרת הדר'), 'התצוגה כוללת את שם העסק');
  assert.ok(preview.includes('ישראל ישראלי'), 'התצוגה כוללת שם-לקוח לדוגמה');
});

test('previewTemplate: שדה-עסק חסר מוצג כריק ולא כסוגריים', () => {
  const preview = previewTemplate('טלפון: {{businessPhone}}.', {
    businessName: 'עסק',
  });
  assert.equal(preview, 'טלפון: .');
});
