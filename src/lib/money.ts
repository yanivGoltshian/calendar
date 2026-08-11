/** עזרי כסף — הכסף נשמר תמיד כמספר שלם של אגורות. */

export function agorotToShekels(agorot: number): number {
  return agorot / 100;
}

/** עיצוב סכום באגורות למחרוזת בשקלים בעברית, למשל 12000 → "‏120 ₪" */
export function formatAgorot(agorot: number): string {
  const shekels = agorotToShekels(agorot);
  const formatted = new Intl.NumberFormat('he-IL', {
    minimumFractionDigits: Number.isInteger(shekels) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(shekels);
  return `${formatted} ₪`;
}

export function shekelsToAgorot(shekels: number): number {
  return Math.round(shekels * 100);
}
