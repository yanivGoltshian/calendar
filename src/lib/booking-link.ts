import { absoluteUrl } from '@/lib/seo';

/**
 * עוזרים טהורים לבניית קישור ההזמנות הציבורי של עסק ולזיהוי מצב "חי".
 * ללא תלות בבסיס נתונים, כדי שיהיו ניתנים לבדיקה ולשימוש חוזר בשרת ובלקוח.
 */

/** הנתיב היחסי לעמוד ההזמנות הציבורי של העסק. */
export function bookingPath(slug: string): string {
  return `/b/${slug}`;
}

/** כתובת מוחלטת לעמוד ההזמנות, בנויה על עוזר בסיס הכתובת המשותף. */
export function bookingUrl(slug: string): string {
  return absoluteUrl(bookingPath(slug));
}

/**
 * נתיב "קביעת תור חוזר": קישור עמוק לעמוד העסק עם שירות (ואופציונלית איש צוות)
 * מסומנים מראש, שנוחת בזרימת ההזמנה ומדלג ישר לבחירת המועד. מקור אמת יחיד לקישור
 * זה — משמש גם את הודעת הסיכום שאחרי הביקור וגם את כפתור "קבעו שוב" באזור החשבון.
 * ערכי ה-query מקודדים (encodeURIComponent) כדי לשמור על כתובת תקינה.
 */
export function rebookPath(
  slug: string,
  serviceId: string,
  staffId?: string | null,
): string {
  const base = `${bookingPath(slug)}?rebook=${encodeURIComponent(serviceId)}`;
  return staffId ? `${base}&staff=${encodeURIComponent(staffId)}` : base;
}

/** כתובת מוחלטת ל"קביעת תור חוזר", בנויה על עוזר בסיס הכתובת המשותף. */
export function rebookUrl(
  slug: string,
  serviceId: string,
  staffId?: string | null,
): string {
  return absoluteUrl(rebookPath(slug, serviceId, staffId));
}

/**
 * שער "העסק חי": המינימום לקבלת הזמנות הוא לפחות שירות אחד ושעות פעילות מוגדרות.
 * מסתמך על אותם אותות השלמה שכבר מחושבים לרשימת ההקמה.
 */
export function isBusinessLive(input: {
  serviceCount: number;
  workingHoursCount: number;
}): boolean {
  return input.serviceCount > 0 && input.workingHoursCount > 0;
}
