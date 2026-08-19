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
 * שער "העסק חי": המינימום לקבלת הזמנות הוא לפחות שירות אחד ושעות פעילות מוגדרות.
 * מסתמך על אותם אותות השלמה שכבר מחושבים לרשימת ההקמה.
 */
export function isBusinessLive(input: {
  serviceCount: number;
  workingHoursCount: number;
}): boolean {
  return input.serviceCount > 0 && input.workingHoursCount > 0;
}
