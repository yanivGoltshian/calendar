/**
 * ערכת עיצוב פרימיום מקומית לאזור החשבון (/account).
 *
 * עמוד /account אינו יורש את משתני הצבע של עמוד העסק (‎--c-cream‎ וכו'),
 * ולכן הטוקנים כאן הם ערכי hex עצמאיים בהשראת המוקאפ המאושר: קרם חם, זהב,
 * ורוד עדין, וטקסט דיו כהה. משמש גם ברכיבי השרת וגם ברכיבי הלקוח שבתיקייה.
 */

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60';

/** כפתור זהב ראשי (קריאה לפעולה). */
export const btnGold = `${btnBase} bg-[linear-gradient(90deg,#a6863f,#c6a86a)] text-[#241d10] shadow-[0_12px_26px_-14px_rgba(166,134,63,0.75)] hover:brightness-105`;

/** כפתור לבן משני (מסגרת עדינה). */
export const btnWhite = `${btnBase} border border-[#e7ddcd] bg-white text-[#1b1715] hover:bg-[#f3ece0]`;

/** כפתור פעולה הרסנית מלא (ביטול/מחיקה בשלב האישור). */
export const btnDanger = `${btnBase} bg-[#c08f86] text-white shadow-[0_12px_26px_-14px_rgba(192,143,134,0.8)] hover:bg-[#a06c63]`;

/** כפתור הרסני עדין (חשיפה ראשונית, בורדר ורוד על לבן). */
export const btnDangerGhost = `${btnBase} border border-[#e2c9c3] bg-white text-[#a06c63] hover:bg-[#f7efec]`;

/** כרטיס פרימיום: לבן, פינות רכות, פס זהב עליון וצל רך. */
export const premiumCard =
  "relative overflow-hidden rounded-[26px] border border-[#e7ddcd] bg-white p-6 shadow-[0_24px_50px_-32px_rgba(40,28,18,0.45)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[linear-gradient(90deg,#c6a86a,#c08f86,#b0855f)] before:content-['']";

/** בסיס לכפתורים קטנים (בתוך כרטיסי תור). */
const btnBaseSm =
  'inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60';

/** כפתור לבן קטן. */
export const btnWhiteSm = `${btnBaseSm} border border-[#e7ddcd] bg-white text-[#1b1715] hover:bg-[#f3ece0]`;

/** כפתור הרסני מלא קטן. */
export const btnDangerSm = `${btnBaseSm} bg-[#c08f86] text-white hover:bg-[#a06c63]`;

/** כפתור הרסני עדין קטן. */
export const btnDangerGhostSm = `${btnBaseSm} border border-[#e2c9c3] bg-white text-[#a06c63] hover:bg-[#f7efec]`;
