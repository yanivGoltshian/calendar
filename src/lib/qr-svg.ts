import qrcode from 'qrcode-generator';

/**
 * בונה קוד QR כמחרוזת SVG מוטבעת, לשימוש בצד השרת (ללא תלות ב-DOM).
 * הפלט הוא נתיב יחיד עם רקע לבן ומודולים כהים, כדי לשמור על סריקוּת גבוהה.
 */

type QrOptions = {
  /** תווית נגישוּת לקורא מסך (aria-label). */
  label?: string;
  /** צבע המודולים הכהים. ברירת מחדל: נייבי המותג. */
  dark?: string;
  /** צבע הרקע. ברירת מחדל: לבן. */
  light?: string;
};

/** בריחת תווים מיוחדים לשילוב בטוח בתוך מאפיין XML. */
function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * מחזיר מחרוזת SVG של קוד QR עבור הכתובת הנתונה.
 * אזור שקט של 4 מודולים נשמר סביב הקוד לפי תקן ה-QR.
 */
export function bookingQrSvg(data: string, options: QrOptions = {}): string {
  const dark = options.dark ?? '#0a182d';
  const light = options.light ?? '#ffffff';

  // typeNumber 0 בוחר אוטומטית את הגרסה הקטנה ביותר שמכילה את הנתונים.
  const qr = qrcode(0, 'M');
  qr.addData(data, 'Byte');
  qr.make();

  const count = qr.getModuleCount();
  const quiet = 4;
  const total = count + quiet * 2;

  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        const x = col + quiet;
        const y = row + quiet;
        path += `M${x} ${y}h1v1h-1z`;
      }
    }
  }

  const labelAttr = options.label
    ? ` role="img" aria-label="${escapeXmlAttr(options.label)}"`
    : ' role="img"';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"` +
    ` width="100%" height="100%" shape-rendering="crispEdges"` +
    ` style="display:block"${labelAttr}>` +
    `<rect x="0" y="0" width="${total}" height="${total}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    `</svg>`
  );
}
