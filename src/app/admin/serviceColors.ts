// פלטת צבעים לשירותים ביומן הניהול (בהיר, תואם לעמודי האדמין).
// הצבעים נשמרים כאן (ספציפי ליומן) ולא בטוקני העיצוב הגלובליים.
// כל ערך: רקע רך, מסגרת/הדגשה, וטקסט כהה לקריאוּת.
export type ServiceColor = { bg: string; border: string; text: string };

export const SERVICE_PALETTE: readonly ServiceColor[] = [
  { bg: '#EDE9FE', border: '#7A37E0', text: '#4C1D95' }, // סגול מותג
  { bg: '#FEF3C7', border: '#D99A26', text: '#78350F' }, // זהב
  { bg: '#DCFCE7', border: '#16A34A', text: '#14532D' }, // ירוק
  { bg: '#DBEAFE', border: '#2563EB', text: '#1E3A8A' }, // כחול
  { bg: '#FCE7F3', border: '#DB2777', text: '#831843' }, // ורוד
  { bg: '#CCFBF1', border: '#0D9488', text: '#134E4A' }, // טורקיז
  { bg: '#FFEDD5', border: '#EA580C', text: '#7C2D12' }, // כתום
  { bg: '#E0E7FF', border: '#4F46E5', text: '#312E81' }, // אינדיגו
];

export const PALETTE_SIZE = SERVICE_PALETTE.length;

/** צבע לפי אינדקס (מעגלי, בטוח לשלילי). */
export function serviceColor(index: number): ServiceColor {
  const i = ((index % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE;
  return SERVICE_PALETTE[i];
}

/** אינדקס יציב מתוך מחרוזת (fallback לשירות שאינו ברשימה הנוכחית). */
export function hashToIndex(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % PALETTE_SIZE;
}
