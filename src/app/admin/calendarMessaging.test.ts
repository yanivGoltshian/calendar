import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { t } from '@/i18n';

/**
 * טסטי נעילה למסרי ההקמה (באג 8) ולעיצוב היומן (באג 11).
 * מונעים רגרסיה של סתירה "הושלמה" ליד "נשארו N", ונועלים את סמני העיצוב
 * החדש של היומן לפי המוקאפ.
 */

const admin = t.admin as {
  onboarding: {
    premium: { editor: { wizard: { kicker: string; stepCounter: string; stepRemain: string } } };
  };
  calendar: {
    boardTitle: string;
    dayTab: string;
    weekTab: string;
    legendTitle: string;
    dragHint: string;
  };
};

test('messaging: כותרת האשף מתויגת כפרימיום, לא כהקמה שהושלמה', () => {
  const w = admin.onboarding.premium.editor.wizard;
  assert.equal(w.kicker, 'עמוד פרימיום');
  assert.doesNotMatch(w.kicker, /הקמה/, 'הכותרת חייבת להיות נפרדת מ"הקמה"');
  assert.doesNotMatch(w.kicker, /הושלמ/, 'הכותרת לא יכולה לטעון "הושלם"');
});

test('messaging: מונה השלבים ותווית "נשארו" אינם מכילים מילת השלמה', () => {
  const w = admin.onboarding.premium.editor.wizard;
  const header = `${w.stepCounter} ${w.stepRemain}`;
  assert.doesNotMatch(header, /הושלמ/, '"נשארו N" לא יכול להופיע ליד "הושלמה"');
  assert.doesNotMatch(header, /מוכן/);
  assert.match(w.stepRemain, /נשארו/, 'תווית ה"נשארו" עצמה נאמנה למוקאפ');
});

// ── נעילה 7: היומן מרנדר את סמני העיצוב החדש לפי המוקאפ ──
test('calendar i18n: מפתחות העיצוב החדש קיימים בעברית', () => {
  assert.equal(admin.calendar.boardTitle, 'היומן שלי');
  assert.equal(admin.calendar.dayTab, 'יום');
  assert.equal(admin.calendar.weekTab, 'שבוע');
  assert.equal(admin.calendar.legendTitle, 'צבע לפי שירות');
  assert.match(admin.calendar.dragHint, /גררו/);
});

test('calendar source: מכיל את סמני ה-.cal מהמוקאפ', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, 'CalendarBoard.tsx'), 'utf8');
  for (const marker of ['className="cal"', 'cal-head', 'seg2', 'cal-nav', 'legend', 'chd', 'cal-foot']) {
    assert.ok(src.includes(marker), `חסר סמן עיצוב ביומן: ${marker}`);
  }
});
