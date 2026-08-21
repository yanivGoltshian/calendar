// בוני קישורי מפה טהורים לעמוד הקליניקה — הכל נבנה מכתובת טקסט מקודדת URL, ללא קואורדינטות.
// משמשים גם את מקטע "איך מגיעים אלינו" (iframe + כפתורי ניווט) וגם בדיקות היחידה.

// מנרמל כתובת: מסיר רווחים עודפים בקצוות. מחזיר מחרוזת ריקה אם אין קלט.
function cleanAddress(address: string | null | undefined): string {
  return (address ?? '').trim();
}

// קישור להטמעת מפה (iframe) — Google Maps במצב embed לפי שאילתת הכתובת.
export function mapEmbedUrl(address: string | null | undefined): string | null {
  const q = cleanAddress(address);
  if (!q) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}

// קישור ניווט ל-Google Maps (פתיחת חיפוש כתובת ביישום/דפדפן).
export function googleMapsSearchUrl(address: string | null | undefined): string | null {
  const q = cleanAddress(address);
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

// קישור ניווט ל-Waze לפי שאילתת כתובת.
export function wazeUrl(address: string | null | undefined): string | null {
  const q = cleanAddress(address);
  if (!q) return null;
  return `https://waze.com/ul?q=${encodeURIComponent(q)}`;
}
