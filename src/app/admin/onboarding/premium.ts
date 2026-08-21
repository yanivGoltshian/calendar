/**
 * לוגיקה טהורה (ללא JSX וללא גישה ל-DB) עבור תתי-שלבי עמוד הפרימיום באשף ההקמה.
 * מנותקת מ-React ומ-Prisma כדי שתהיה קלה לבדיקה תחת node --test.
 *
 * שתי אחריות:
 *  1. parsePremiumDraft — קריאה בטוחה של טיוטת ה-JSON מהאשף אל LandingContent מנורמל.
 *  2. buildDefaultSectionToggles — זריעת מצב ההצגה ההתחלתי של המקטעים לפי סוג העסק.
 */

import {
  normalizeLandingContent,
  landingSectionEnabledByDefault,
  TOGGLEABLE_LANDING_SECTIONS,
  type LandingContent,
  type LandingSectionToggles,
} from '@/lib/publicPageStyle';

/**
 * מנתח את טיוטת עמוד הפרימיום שנשלחה כמחרוזת JSON יחידה מהאשף.
 *  - קלט שאינו מחרוזת או מחרוזת ריקה ⇐ null (אין תוכן לשמור).
 *  - JSON פגום ⇐ null (הגנה מלאה מפני קלט לא-תקין).
 *  - קלט תקין ⇐ מועבר ל-normalizeLandingContent שמבצע קיטום, ולידציה ואכיפת מגבלות.
 *
 * מחזיר LandingContent מנורמל, או null כשאין תוכן ממשי — כך ש-null ישמור NULL במסד.
 */
export function parsePremiumDraft(raw: unknown): LandingContent | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  return normalizeLandingContent(parsed);
}

/**
 * בונה את מפת ההצגה/הסתרה ההתחלתית של המקטעים הניתנים לכיבוי, לפי סוג העסק.
 * משמש כדי לזרוע את תיבות הסימון בתת-שלב הסגירה, בעקביות עם התנהגות עמוד הנחיתה
 * (למשל "לפני/אחרי" מודלק כברירת מחדל רק בסוגים ויזואליים, "שאלות נפוצות" באופט-אין).
 */
export function buildDefaultSectionToggles(type?: string | null): LandingSectionToggles {
  const toggles: LandingSectionToggles = {};
  for (const section of TOGGLEABLE_LANDING_SECTIONS) {
    toggles[section] = landingSectionEnabledByDefault(section, type);
  }
  return toggles;
}
