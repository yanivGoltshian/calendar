import he, { type Dictionary } from './he';

/**
 * תשתית i18n מינימלית. כרגע עברית היא ברירת המחדל והשפה הפעילה היחידה,
 * אך המבנה מאפשר הוספת שפות נוספות בעתיד ללא שינוי בקוד הצריכה.
 */
export const DEFAULT_LOCALE = 'he' as const;
export const LOCALES = ['he'] as const;
export type Locale = (typeof LOCALES)[number];

const dictionaries: Record<Locale, Dictionary> = {
  he,
};

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? he;
}

/** קיצור נוח: המילון הפעיל (עברית) */
export const t = he;

export type { Dictionary };
