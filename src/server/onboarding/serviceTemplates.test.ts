import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BusinessType } from '@prisma/client';
import {
  getServiceTemplate,
  DEFAULT_SERVICE_TEMPLATE,
  type ServiceTemplateItem,
} from './serviceTemplates';

/**
 * בדיקות ל-getServiceTemplate — תבניות השירות ההתחלתיות שנזרעות לעסק חדש.
 * מטרה: לוודא שכל סוג עסק מקבל תבנית שמישה (לא ריקה, שדות תקינים) ושסוג לא מוכר,
 * OTHER, null או undefined נופלים לתבנית ברירת המחדל. בדיקות טהורות ללא DB,
 * בסגנון שאר בדיקות היחידה במאגר (node:test + assert/strict).
 */

// רשימת סוגי העסק כפי שמוגדרים ב-BusinessType בסכמת Prisma (חוזה יציב, ללא ייבוא runtime).
const ALL_BUSINESS_TYPES = [
  'BARBERSHOP',
  'HAIR_SALON',
  'NAILS',
  'BEAUTY_COSMETICS',
  'SPA_MASSAGE',
  'BROWS_LASHES',
  'TATTOO_PIERCING',
  'CLINIC',
  'FITNESS',
  'OTHER',
] as const satisfies readonly BusinessType[];

function assertValidTemplate(items: ServiceTemplateItem[], label: string) {
  assert.ok(items.length > 0, `${label}: התבנית לא אמורה להיות ריקה`);
  for (const item of items) {
    assert.equal(typeof item.name, 'string', `${label}: שם חייב להיות מחרוזת`);
    assert.ok(item.name.trim().length > 0, `${label}: שם לא אמור להיות ריק`);
    assert.ok(item.durationMin > 0, `${label}: משך חייב להיות חיובי`);
    assert.ok(
      Number.isInteger(item.durationMin),
      `${label}: משך חייב להיות מספר שלם`,
    );
    assert.ok(item.priceAgorot >= 0, `${label}: מחיר לא אמור להיות שלילי`);
    assert.ok(
      Number.isInteger(item.priceAgorot),
      `${label}: מחיר חייב להיות מספר שלם`,
    );
  }
}

test('getServiceTemplate: כל סוג עסק מחזיר תבנית שמישה עם שדות תקינים', () => {
  for (const type of ALL_BUSINESS_TYPES) {
    assertValidTemplate(getServiceTemplate(type), type);
  }
});

test('getServiceTemplate: null/undefined נופלים לתבנית ברירת המחדל', () => {
  assert.deepEqual(getServiceTemplate(null), DEFAULT_SERVICE_TEMPLATE);
  assert.deepEqual(getServiceTemplate(undefined), DEFAULT_SERVICE_TEMPLATE);
});

test('getServiceTemplate: OTHER נופל לתבנית ברירת המחדל', () => {
  assert.deepEqual(getServiceTemplate('OTHER'), DEFAULT_SERVICE_TEMPLATE);
});

test('getServiceTemplate: שמות השירותים ייחודיים בכל תבנית', () => {
  for (const type of ALL_BUSINESS_TYPES) {
    const names = getServiceTemplate(type).map((s) => s.name);
    assert.equal(
      new Set(names).size,
      names.length,
      `${type}: ציפינו לשמות שירות ייחודיים`,
    );
  }
});

test('DEFAULT_SERVICE_TEMPLATE: תקין ולא ריק', () => {
  assertValidTemplate(DEFAULT_SERVICE_TEMPLATE, 'DEFAULT');
});
