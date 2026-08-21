import bidiFactory from 'bidi-js';

/**
 * המרת טקסט לסדר ויזואלי (visual order) עבור satori/next-og.
 *
 * הרקע: הגרסה של satori שמגיעה עם next/og אינה מריצה אלגוריתם bidi ואינה
 * מכבדת direction:'rtl' — היא מציירת את התווים בסדר הלוגי (מ-code point ראשון
 * לאחרון), ולכן טקסט עברי יוצא הפוך בכרטיס השיתוף ("מספרת הבית" => "תיבה תרפסמ").
 *
 * הפתרון: מריצים את אלגוריתם ה-bidi של יוניקוד ידנית (bidi-js) וממירים את
 * המחרוזת לסדר הראוי לתצוגה *לפני* שמעבירים אותה ל-ImageResponse. אז satori
 * שמצייר "כמו שהוא" מקבל כבר את הסדר הנכון. ספרות ורצפים לטיניים בתוך טקסט
 * עברי (למשל "החדר 24") נשמרים בכיוונם הנכון כי האלגוריתם מזהה אותם כ-runs
 * נפרדים. base direction='auto' => נגזר מהתו החזק הראשון (עברי => RTL).
 *
 * שימוש רק לרינדור התמונה. אין להשתמש בפלט כטקסט לוגי (למשל ב-alt/description).
 */

const bidi = bidiFactory();

/** מחזיר את הטקסט בסדר ויזואלי לרינדור ב-satori; ריק/לא-מחרוזת => ''. */
export function toVisualOrder(text: string | null | undefined): string {
  if (!text) return '';
  const str = String(text);
  if (!str.trim()) return str;
  try {
    const levels = bidi.getEmbeddingLevels(str, 'auto');
    return bidi.getReorderedString(str, levels);
  } catch {
    // בכשל בלתי צפוי עדיף להחזיר את הטקסט המקורי מאשר להפיל את הרינדור.
    return str;
  }
}
