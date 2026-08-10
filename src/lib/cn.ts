type ClassValue = string | number | null | false | undefined;

/**
 * cn — צירוף מחלקות Tailwind בצורה בטוחה (ללא תלות חיצונית).
 * מסנן ערכים ריקים ומאחד למחרוזת אחת.
 */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}

export default cn;
