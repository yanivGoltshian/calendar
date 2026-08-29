import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSetupState,
  SETUP_CONTINUE_HREF,
  SETUP_STEP_HREFS,
  type SetupFlags,
} from './setup';

/**
 * טסטי נעילה למצב ההקמה (באגים 8/9/10 + באג 1 סבב 2) — מקור אמת יחיד שמזין את
 * הבית ואת האשף. נועלים: אחוז אמיתי כשלא הכול הושלם, יעד ההמשך הוא עומק-קישור
 * למסך הצעד החסר הראשון, והצעד הפתוח הראשון מחושב נכון (ניווט ישיר).
 */

function flags(partial: Partial<SetupFlags>): SetupFlags {
  return {
    servicesDone: false,
    staffDone: false,
    workingHoursDone: false,
    brandingDone: false,
    detailsDone: false,
    ...partial,
  };
}

// ── נעילה 6: טבעת ההשלמה מציגה אחוז אמיתי כשצעדי הפרימיום לא הושלמו ──
test('setup: אחוז קטן מ-100 ו-allComplete=false כשלא הכול הושלם', () => {
  const s = computeSetupState(flags({ servicesDone: true, staffDone: true }));
  assert.equal(s.total, 5);
  assert.equal(s.done, 2);
  assert.equal(s.percent, 40);
  assert.equal(s.allComplete, false);
  assert.ok(s.percent < 100, 'הטבעת לא יכולה להראות 100% כשיש צעדים חסרים');
});

// ── נעילה 1 (סבב 2): «המשך» מנווט למסך הצעד החסר הראשון, לא לתחילת האונבורדינג ──
test('setup: כשכלום לא הושלם, יעד ההמשך הוא מסך השירותים', () => {
  const s = computeSetupState(flags({}));
  assert.equal(s.continueHref, SETUP_STEP_HREFS.servicesDone);
  assert.equal(s.continueHref, '/admin/services');
});

test('setup: יעד ההמשך עוקב אחר הצעד החסר הראשון (עומק-קישור למסך הנכון)', () => {
  // שירותים+צוות הושלמו → הצעד החסר הראשון הוא שעות פעילות
  assert.equal(
    computeSetupState(flags({ servicesDone: true, staffDone: true }))
      .continueHref,
    '/admin/working-hours',
  );
  // הכול חוץ ממיתוג → «המשך» מוביל למסך ההגדרות (מיתוג)
  assert.equal(
    computeSetupState(
      flags({
        servicesDone: true,
        staffDone: true,
        workingHoursDone: true,
        detailsDone: true,
      }),
    ).continueHref,
    SETUP_STEP_HREFS.brandingDone,
  );
  // רק פרטי העסק חסרים → «המשך» מוביל למסך ההגדרות/מדיניות
  assert.equal(
    computeSetupState(
      flags({
        servicesDone: true,
        staffDone: true,
        workingHoursDone: true,
        brandingDone: true,
      }),
    ).continueHref,
    '/admin/settings',
  );
});

test('setup: כשהכול הושלם, יעד ההמשך נופל לנתיב האונבורדינג', () => {
  const s = computeSetupState(
    flags({
      servicesDone: true,
      staffDone: true,
      workingHoursDone: true,
      brandingDone: true,
      detailsDone: true,
    }),
  );
  assert.equal(s.continueHref, SETUP_CONTINUE_HREF);
  assert.equal(s.continueHref, '/admin/onboarding');
});

test('setup: 100% ו-allComplete=true רק כשכל חמשת הדגלים דלוקים', () => {
  const s = computeSetupState(
    flags({
      servicesDone: true,
      staffDone: true,
      workingHoursDone: true,
      brandingDone: true,
      detailsDone: true,
    }),
  );
  assert.equal(s.percent, 100);
  assert.equal(s.allComplete, true);
  assert.equal(s.remaining, 0);
  assert.equal(s.firstOpenIndex, -1);
});

// ── נעילה 8: כפתור «המשך» מנווט לצעד הפתוח הראשון (firstOpenIndex תקין) ──
test('setup: firstOpenIndex מצביע על הצעד החסר הראשון כשלא הכול הושלם', () => {
  const s = computeSetupState(flags({ servicesDone: true }));
  // servicesDone=true → הצעד הפתוח הראשון הוא staff (אינדקס 1)
  assert.equal(s.firstOpenIndex, 1);
  assert.ok(s.firstOpenIndex >= 0, 'חייב להיות צעד פתוח כשההקמה לא הושלמה');
});

test('setup: כשכלום לא הושלם, firstOpenIndex=0 ו-remaining=5', () => {
  const s = computeSetupState(flags({}));
  assert.equal(s.firstOpenIndex, 0);
  assert.equal(s.remaining, 5);
  assert.equal(s.percent, 0);
});

// ── נעילה 8: כפתור «המשך» מנווט לצעד הפתוח הראשון (firstOpenIndex תקין) ──
test('setup: firstOpenIndex מצביע על הצעד החסר הראשון כשלא הכול הושלם', () => {
  const s = computeSetupState(flags({ servicesDone: true }));
  // servicesDone=true → הצעד הפתוח הראשון הוא staff (אינדקס 1)
  assert.equal(s.firstOpenIndex, 1);
  assert.ok(s.firstOpenIndex >= 0, 'חייב להיות צעד פתוח כשההקמה לא הושלמה');
});

test('setup: כשכלום לא הושלם, firstOpenIndex=0 ו-remaining=5', () => {
  const s = computeSetupState(flags({}));
  assert.equal(s.firstOpenIndex, 0);
  assert.equal(s.remaining, 5);
  assert.equal(s.percent, 0);
});
