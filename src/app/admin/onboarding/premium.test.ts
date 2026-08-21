import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePremiumDraft, buildDefaultSectionToggles } from './premium';

/**
 * בדיקות יחידה טהורות ללוגיקת תתי-שלבי הפרימיום.
 * מכסות ניתוח בטוח של טיוטת ה-JSON וזריעת מצב המקטעים ההתחלתי.
 */

test('parsePremiumDraft: קלט שאינו מחרוזת מחזיר null', () => {
  assert.equal(parsePremiumDraft(null), null);
  assert.equal(parsePremiumDraft(undefined), null);
  assert.equal(parsePremiumDraft(42), null);
  assert.equal(parsePremiumDraft({ heroHeadline: 'x' }), null);
});

test('parsePremiumDraft: מחרוזת ריקה או רווחים בלבד מחזירה null', () => {
  assert.equal(parsePremiumDraft(''), null);
  assert.equal(parsePremiumDraft('   '), null);
});

test('parsePremiumDraft: JSON פגום מחזיר null במקום לזרוק', () => {
  assert.equal(parsePremiumDraft('{lo:'), null);
  assert.equal(parsePremiumDraft('not json at all'), null);
});

test('parsePremiumDraft: אובייקט ריק לאחר נרמול מחזיר null', () => {
  assert.equal(parsePremiumDraft('{}'), null);
  // שדות ריקים בלבד — הנרמול משמיט אותם ומחזיר null
  assert.equal(parsePremiumDraft('{"heroHeadline":"   ","about":""}'), null);
});

test('parsePremiumDraft: תוכן תקין עובר נרמול, קיטום רווחים ומיפוי שדות', () => {
  const raw = JSON.stringify({
    heroEyebrow: '  סטודיו בוטיק  ',
    heroHeadline: 'חוויה שמרגישים',
    about: '  קצת עלינו  ',
    ctaLabel: 'לקביעת תור',
  });
  const result = parsePremiumDraft(raw);
  assert.ok(result);
  assert.equal(result?.heroEyebrow, 'סטודיו בוטיק');
  assert.equal(result?.heroHeadline, 'חוויה שמרגישים');
  assert.equal(result?.about, 'קצת עלינו');
  assert.equal(result?.ctaLabel, 'לקביעת תור');
});

test('parsePremiumDraft: מסנן פריטים ריקים ואוכף מגבלות דרך הנרמול', () => {
  const raw = JSON.stringify({
    benefits: [
      { title: 'שירות אישי', text: 'יחס חם' },
      { title: '', text: '' }, // ריק — יסונן
      { title: 'איכות', text: '' },
      { title: 'ניסיון', text: 'שנים בתחום' },
      { title: 'עודף', text: 'מעבר למגבלה' }, // מעבר ל-MAX_BENEFITS=3
    ],
    beforeAfter: [
      { beforeUrl: 'https://a/1.jpg', afterUrl: 'https://a/2.jpg', label: 'טיפול' },
      { beforeUrl: 'https://a/3.jpg', afterUrl: '', label: 'חסר אחרי' }, // זוג לא שלם — יסונן
    ],
    faq: [
      { question: 'שאלה', answer: 'תשובה' },
      { question: 'רק שאלה', answer: '' }, // חצי — יסונן
    ],
  });
  const result = parsePremiumDraft(raw);
  assert.ok(result);
  assert.equal(result?.benefits?.length, 3); // אוכף MAX_BENEFITS ומסנן ריקים
  assert.equal(result?.beforeAfter?.length, 1); // רק הזוג השלם נשמר
  assert.equal(result?.faq?.length, 1); // רק שאלה+תשובה מלאות נשמרות
});

test('buildDefaultSectionToggles: כולל את כל המקטעים הניתנים לכיבוי ולא את hero', () => {
  const toggles = buildDefaultSectionToggles('OTHER');
  assert.equal(Object.prototype.hasOwnProperty.call(toggles, 'hero'), false);
  assert.equal(typeof toggles.services, 'boolean');
  assert.equal(typeof toggles.gallery, 'boolean');
  assert.equal(typeof toggles.socialCta, 'boolean');
});

test('buildDefaultSectionToggles: לפני/אחרי מודלק בסוג ויזואלי וכבוי באחר', () => {
  assert.equal(buildDefaultSectionToggles('NAILS').beforeAfter, true);
  assert.equal(buildDefaultSectionToggles('OTHER').beforeAfter, false);
});

test('buildDefaultSectionToggles: שאלות נפוצות כבויות כברירת מחדל (אופט-אין)', () => {
  assert.equal(buildDefaultSectionToggles('OTHER').faq, false);
  assert.equal(buildDefaultSectionToggles('NAILS').faq, false);
});

test('buildDefaultSectionToggles: סוג לא ידוע נופל להתנהגות OTHER', () => {
  const unknown = buildDefaultSectionToggles('NOT_A_TYPE');
  const other = buildDefaultSectionToggles('OTHER');
  assert.deepEqual(unknown, other);
});
