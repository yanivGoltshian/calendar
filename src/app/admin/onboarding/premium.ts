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
  type LandingTheme,
} from '@/lib/publicPageStyle';

/** כרטיס פלטת מותג אצור: מזהה יציב, שם עברי, וסט שמונה גווני theme מתואמים. */
export type BrandPreset = {
  id: string;
  name: string;
  theme: LandingTheme;
};

/**
 * שתים-עשרה פלטות מותג אצורות וקבועות (פיקס) המוצגות בגלריית שלב המיתוג.
 * בחירת כרטיס קובעת brandColor = theme.brand ומזינה את landingContent.theme
 * לגווני עמוד הנחיתה הפרימיום. סדר השדות: brand, brandDark, gold, goldStrong,
 * goldText, cream, ink, accent. הערכים קבועים בכוונה כדי לשמור על מותג מתואם.
 */
export const BRAND_PRESETS: readonly BrandPreset[] = [
  {
    id: 'skin-bronze',
    name: 'סקין ביוטי (ברונזה)',
    theme: {
      brand: '#b0855f',
      brandDark: '#8c6748',
      gold: '#c6a86a',
      goldStrong: '#a6863f',
      goldText: '#8c6748',
      cream: '#faf6ef',
      ink: '#1b1715',
      accent: '#c08f86',
    },
  },
  {
    id: 'soft-rose',
    name: 'ורד רך',
    theme: {
      brand: '#d98ca3',
      brandDark: '#b3697f',
      gold: '#e0b3bf',
      goldStrong: '#c98aa0',
      goldText: '#a15b72',
      cream: '#fdf5f7',
      ink: '#241a1e',
      accent: '#cf7a92',
    },
  },
  {
    id: 'spa-emerald',
    name: 'ספא אמרלד',
    theme: {
      brand: '#3f9d8a',
      brandDark: '#2f7a6b',
      gold: '#8fc9b9',
      goldStrong: '#56a894',
      goldText: '#2c6f60',
      cream: '#f2f8f6',
      ink: '#14211d',
      accent: '#d99a5b',
    },
  },
  {
    id: 'barber-dark',
    name: 'ברבר כהה',
    theme: {
      brand: '#2b3242',
      brandDark: '#1b2130',
      gold: '#b8935a',
      goldStrong: '#9a7942',
      goldText: '#b8935a',
      cream: '#f4f5f7',
      ink: '#12161f',
      accent: '#c96a4b',
    },
  },
  {
    id: 'royal-purple',
    name: 'סגול מלכותי',
    theme: {
      brand: '#7c5cbf',
      brandDark: '#5f45a0',
      gold: '#b9a3e0',
      goldStrong: '#8a6fd4',
      goldText: '#5b47a0',
      cream: '#f7f4fc',
      ink: '#1c1630',
      accent: '#cf7ab0',
    },
  },
  {
    id: 'clinical-blue',
    name: 'כחול קליני',
    theme: {
      brand: '#3b82c4',
      brandDark: '#2c63a0',
      gold: '#8fb9df',
      goldStrong: '#5590c9',
      goldText: '#2c5f96',
      cream: '#f2f7fc',
      ink: '#12202f',
      accent: '#e0975a',
    },
  },
  {
    id: 'warm-coral',
    name: 'קורל חם',
    theme: {
      brand: '#e07a5f',
      brandDark: '#bd5c44',
      gold: '#f0b49b',
      goldStrong: '#d98363',
      goldText: '#b0553a',
      cream: '#fef5f1',
      ink: '#2a1712',
      accent: '#e6a94f',
    },
  },
  {
    id: 'black-gold',
    name: 'שחור-זהב',
    theme: {
      brand: '#3a3a3a',
      brandDark: '#232323',
      gold: '#c9a24b',
      goldStrong: '#a9832f',
      goldText: '#9c7a2c',
      cream: '#f6f5f2',
      ink: '#141414',
      accent: '#c9a24b',
    },
  },
  {
    id: 'natural-beige',
    name: "בז' טבעי",
    theme: {
      brand: '#a89377',
      brandDark: '#86735a',
      gold: '#cbb894',
      goldStrong: '#ad9668',
      goldText: '#7f6a4b',
      cream: '#f8f5ee',
      ink: '#221d16',
      accent: '#c19a86',
    },
  },
  {
    id: 'wine-berry',
    name: 'יין ברי',
    theme: {
      brand: '#9b3b57',
      brandDark: '#7a2b43',
      gold: '#cf8ba0',
      goldStrong: '#b25e78',
      goldText: '#7a2b43',
      cream: '#fbf3f6',
      ink: '#24131a',
      accent: '#d98a5f',
    },
  },
  {
    id: 'turquoise-mint',
    name: 'טורקיז מנטה',
    theme: {
      brand: '#2fa9a2',
      brandDark: '#23847e',
      gold: '#8fd3ce',
      goldStrong: '#4fb8b0',
      goldText: '#256e69',
      cream: '#f1f9f8',
      ink: '#10201f',
      accent: '#e39a6a',
    },
  },
  {
    id: 'charcoal-pink',
    name: 'פחם-ורוד',
    theme: {
      brand: '#4a4550',
      brandDark: '#322e38',
      gold: '#c79fb0',
      goldStrong: '#a87890',
      goldText: '#6f5566',
      cream: '#f6f4f6',
      ink: '#171419',
      accent: '#cf7f9a',
    },
  },
];

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

/** תת-השלבים של עמוד הפרימיום באשף: שער → עורך → סיכום. */
export type PremiumPhase = 'gate' | 'editor' | 'summary';

/**
 * מחשב את שלב הפרימיום ההתחלתי של האשף מתוך prop ה-deep-link.
 *  - 'editor' ⇐ כניסה ישירה לעורך העמוד (‎/admin/onboarding?edit=premium‎),
 *    למשל מיד אחרי «כניסה כבעל העסק» — כך בעל העסק נוחת ישר בעריכת עמוד הפרימיום.
 *  - כל ערך אחר / undefined ⇐ null: הזרימה הקלאסית של שלושת הצעדים
 *    (שירותים → שעות → מיתוג), ורק אחרי שמירת המיתוג נפתח שער הפרימיום.
 */
export function resolveInitialPremiumPhase(initialPremiumPhase?: 'editor'): PremiumPhase | null {
  return initialPremiumPhase === 'editor' ? 'editor' : null;
}

/**
 * זריעת טיוטת הפרימיום בעת טעינת האשף: התוכן הקיים של העסק אם קיים, אחרת טיוטה ריקה.
 * כך העורך נטען מיד עם הנתונים הנוכחיים גם בכניסה ישירה (deep-link), והשמירה עצמאית עובדת.
 */
export function seedPremiumDraft(initial: LandingContent | null | undefined): LandingContent {
  return initial ?? {};
}
