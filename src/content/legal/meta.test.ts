import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGAL_ACCESSIBILITY,
  LEGAL_COMPANY,
  LEGAL_DISCLAIMER_NOTICE,
  LEGAL_UPDATED_ISO,
  LEGAL_UPDATED_LABEL,
} from './meta';

/**
 * בדיקות לנתוני־העל של המדור המשפטי (‎/legal‎). הבאג המקורי: העמודים המשפטיים
 * הוצגו לציבור עם מצייני מקום בסוגריים מרובעים כגון "[שם רכז/ת הנגישות]", מה
 * שחשף את השירות לחשיפה משפטית. בדיקות אלה נועלות את התיקון: הן סורקות את כלל
 * הערכים המחרוזתיים המיוצאים ומוודאות שאין בהם תו של סוגר מרובע, וכן שהשדות
 * המרכזיים מולאו בערכים אמיתיים. שדות ללא ערך אמיתי (טלפון, כתובת, ח״פ) נותרים
 * ריקים במכוון והעמודים אינם מציגים אותם, ולכן מחרוזת ריקה היא ערך תקין.
 * בדיקות טהורות בסגנון שאר בדיקות היחידה במאגר (node:test + assert/strict).
 */

/** אוסף כל הערכים המחרוזתיים המיוצאים מן המדור המשפטי לסריקה. */
const allLegalStrings: string[] = [
  ...Object.values(LEGAL_COMPANY),
  ...Object.values(LEGAL_ACCESSIBILITY),
  LEGAL_DISCLAIMER_NOTICE,
  LEGAL_UPDATED_ISO,
  LEGAL_UPDATED_LABEL,
];

test('אין מצייני מקום בסוגריים מרובעים באף ערך משפטי מיוצא', () => {
  for (const value of allLegalStrings) {
    assert.equal(
      value.includes('['),
      false,
      `נמצא סוגר פתיחה בערך משפטי: ${value}`,
    );
    assert.equal(
      value.includes(']'),
      false,
      `נמצא סוגר סגירה בערך משפטי: ${value}`,
    );
  }
});

test('פרטי בעל השירות מולאו בשם ובדוא״ל אמיתיים', () => {
  assert.equal(LEGAL_COMPANY.legalName, 'יניב גולטשיאן');
  assert.equal(LEGAL_COMPANY.contactEmail, 'yanivgolt@gmail.com');
  assert.ok(LEGAL_COMPANY.jurisdictionCity.trim().length > 0);
});

test('פרטי רכז הנגישות מולאו בשם ובדוא״ל אמיתיים', () => {
  assert.equal(LEGAL_ACCESSIBILITY.coordinatorName, 'יניב גולטשיאן');
  assert.equal(LEGAL_ACCESSIBILITY.coordinatorEmail, 'yanivgolt@gmail.com');
});

test('מועדי העדכון עודכנו לתאריך היעד', () => {
  assert.equal(LEGAL_UPDATED_ISO, '2026-08-19');
  assert.equal(LEGAL_UPDATED_LABEL, '19 באוגוסט 2026');
  assert.equal(LEGAL_ACCESSIBILITY.statementUpdatedIso, '2026-08-19');
  assert.equal(LEGAL_ACCESSIBILITY.statementUpdatedLabel, '19 באוגוסט 2026');
});

test('הערת המדור אינה ממסגרת את התוכן כתבנית לא גמורה', () => {
  assert.equal(LEGAL_DISCLAIMER_NOTICE.includes('תבנית'), false);
  assert.ok(LEGAL_DISCLAIMER_NOTICE.includes('אינו מהווה ייעוץ משפטי'));
});
