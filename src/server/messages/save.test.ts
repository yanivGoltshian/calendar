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
