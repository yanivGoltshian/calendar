import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reminderInclude } from './appointments';

/**
 * רגרסיה: ערוץ התזכורת (reminderChannel) חי על BusinessSettings ולא על Business.
 * שאילתת התזכורות חייבת לבחור אותו מקונן תחת settings, אחרת Prisma זורק שגיאת
 * ולידציה ("Unknown field `reminderChannel` for select statement on model
 * `Business`") והתזכורות מפסיקות להישלח בשקט (הבאג ש-#54 הסווה כ-200 מנוון).
 * הבדיקה נועלת את צורת ה-select הנכונה כדי שהרגרסיה לא תחזור.
 */
test('reminderInclude בוחר reminderChannel תחת business.settings ולא ישירות על business', () => {
  const businessSelect = reminderInclude.business.select as Record<string, unknown>;

  assert.equal(
    'reminderChannel' in businessSelect,
    false,
    'reminderChannel אסור שייבחר ישירות על מודל Business',
  );

  const settings = businessSelect.settings as { select: { reminderChannel: unknown } };
  assert.equal(
    settings.select.reminderChannel,
    true,
    'reminderChannel חייב להיבחר מקונן תחת business.settings',
  );
});
