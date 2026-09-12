import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getChannelDefault } from './registry';
import { resolveTemplateSave } from './save';

/**
 * החלטת השמירה הטהורה: גוף ריק או זהה-לברירת-מחדל ⇒ מחיקה (שחזור); אחרת ⇒ שמירה.
 * נושא נשמר למייל בלבד.
 */

const emailDef = getChannelDefault('booking_confirmation', 'email')!;
const smsDef = getChannelDefault('booking_confirmation', 'sms')!;

test('גוף ריק ⇐ מחיקה (שחזור לברירת מחדל)', () => {
  assert.deepEqual(
    resolveTemplateSave({ key: 'booking_confirmation', channel: 'email', subject: 'משהו', body: '   ' }),
    { action: 'delete' },
  );
});

test('גוף ונושא זהים לברירת המחדל ⇐ מחיקה', () => {
  assert.deepEqual(
    resolveTemplateSave({
      key: 'booking_confirmation',
      channel: 'email',
      subject: emailDef.subject!,
      body: emailDef.body,
    }),
    { action: 'delete' },
  );
});

test('גוף ערוך ⇐ שמירת דריסה (נושא נשמר למייל)', () => {
  assert.deepEqual(
    resolveTemplateSave({
      key: 'booking_confirmation',
      channel: 'email',
      subject: 'נושא חדש',
      body: 'גוף חדש לגמרי',
    }),
    { action: 'upsert', subject: 'נושא חדש', body: 'גוף חדש לגמרי' },
  );
});

test('מייל: גוף ברירת מחדל אך נושא ערוך ⇐ שמירה', () => {
  const op = resolveTemplateSave({
    key: 'booking_confirmation',
    channel: 'email',
    subject: 'נושא ערוך',
    body: emailDef.body,
  });
  assert.deepEqual(op, { action: 'upsert', subject: 'נושא ערוך', body: emailDef.body });
});

test('מייל: נושא ריק בשמירה ⇐ null (נפילה חזרה לברירת המחדל ברינדור)', () => {
  const op = resolveTemplateSave({
    key: 'booking_confirmation',
    channel: 'email',
    subject: '  ',
    body: 'גוף שונה מברירת המחדל',
  });
  assert.deepEqual(op, { action: 'upsert', subject: null, body: 'גוף שונה מברירת המחדל' });
});

test('SMS: נושא תמיד נכפה ל-null גם אם סופק', () => {
  const op = resolveTemplateSave({
    key: 'booking_confirmation',
    channel: 'sms',
    subject: 'לא רלוונטי',
    body: 'גוף מסרון שונה',
  });
  assert.deepEqual(op, { action: 'upsert', subject: null, body: 'גוף מסרון שונה' });
});

test('SMS: גוף זהה לברירת המחדל ⇐ מחיקה', () => {
  assert.deepEqual(
    resolveTemplateSave({ key: 'booking_confirmation', channel: 'sms', subject: null, body: smsDef.body }),
    { action: 'delete' },
  );
});

/**
 * מודעות-הקשר: העורך מציג ברירת-מחדל שמשתני-העסק בה כבר מולאו. בעל עסק שלוחץ
 * שמירה בלי לגעת שולח גוף מלא-פרטים, וההשוואה חייבת לזהות אותו כברירת-המחדל
 * ולמחוק — אחרת נוצרת דריסה מיותרת שמקבעת ערכים ומורידה מייל לנוסח פשוט.
 */

import { fillBusinessTokens, type BusinessTemplateContext } from './businessTokens';

const bizCtx: BusinessTemplateContext = {
  businessName: 'מספרת הדר',
  businessPhone: '03-1234567',
  businessAddress: 'הרצל 10, תל אביב',
};

test('ctx — מייל: גוף+נושא מלאי-פרטים ללא עריכה ⇐ מחיקה', () => {
  assert.deepEqual(
    resolveTemplateSave(
      {
        key: 'booking_confirmation',
        channel: 'email',
        subject: fillBusinessTokens(emailDef.subject!, bizCtx),
        body: fillBusinessTokens(emailDef.body, bizCtx),
      },
      bizCtx,
    ),
    { action: 'delete' },
  );
});

test('ctx — SMS: גוף מלא-פרטים ללא עריכה ⇐ מחיקה', () => {
  assert.deepEqual(
    resolveTemplateSave(
      {
        key: 'booking_confirmation',
        channel: 'sms',
        subject: null,
        body: fillBusinessTokens(smsDef.body, bizCtx),
      },
      bizCtx,
    ),
    { action: 'delete' },
  );
});

test('ctx — מייל: גוף מלא-פרטים שנערך ⇐ שמירת דריסה', () => {
  const editedBody = fillBusinessTokens(emailDef.body, bizCtx) + '\nנ.ב. חניה בחצר.';
  assert.deepEqual(
    resolveTemplateSave(
      {
        key: 'booking_confirmation',
        channel: 'email',
        subject: fillBusinessTokens(emailDef.subject!, bizCtx),
        body: editedBody,
      },
      bizCtx,
    ),
    { action: 'upsert', subject: fillBusinessTokens(emailDef.subject!, bizCtx), body: editedBody },
  );
});

test('ctx — בלי הקשר, גוף מלא-פרטים אינו זהה לברירת-המחדל הגולמית ⇐ שמירה', () => {
  // בלי ctx ההשוואה מול הגולמי (עם סוגריים), ולכן גוף שמולא נחשב עריכה.
  const filled = fillBusinessTokens(smsDef.body, bizCtx);
  assert.deepEqual(
    resolveTemplateSave({ key: 'booking_confirmation', channel: 'sms', subject: null, body: filled }),
    { action: 'upsert', subject: null, body: filled },
  );
});
