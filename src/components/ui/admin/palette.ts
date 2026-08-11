/**
 * פלטת אזור הניהול (נייבי + זהב) — ערכת צבעים מבודדת לרכיבי ה-admin בלבד.
 *
 * הצבעים מיושמים ברכיבים כ-hex ארביטררי של Tailwind (למשל bg-[#0B1526]),
 * כדי לא לגעת בקובץ tailwind.config או ברכיבי העיצוב הכלליים (הפלטה הכללית נייבי-זהב).
 * הקבועים כאן זמינים לשימוש ישיר (למשל ב-style inline או בגרפים) בעת הצורך.
 */
export const adminPalette = {
  // נייבי
  navyBase: '#0B1526',
  navyEdge: '#08101C',
  navyGlow: '#16233A',
  // זהב
  goldLight: '#F2D695',
  goldMid: '#C59D5F',
  goldDeep: '#82643C',
  // ניטרלי לטקסט על רקע כהה
  textOnDark: '#E8ECF3',
  textMutedOnDark: '#9AA7BD',
} as const;

export type AdminPalette = typeof adminPalette;
