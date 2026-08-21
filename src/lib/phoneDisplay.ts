// עיצוב טלפון ישראלי לתצוגה בלבד. הקישור (tel:) נשאר במספר המנורמל (+972…),
// אך התצוגה מוצגת בפורמט מקומי קריא (למשל 054-675-5521). טהור וללא תלות ב-DOM.

// ממיר מספר מנורמל (+9725XXXXXXXX) לפורמט מקומי עם מקפים.
// קלט שאינו בפורמט ישראלי מנורמל מוחזר כפי שהוא (בטוח לכל עסק).
export function formatIsraeliPhoneDisplay(phone: string | null | undefined): string {
  const raw = (phone ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  const match = /^\+972(\d{8,9})$/.exec(digits);
  if (!match) return raw;
  const local = `0${match[1]}`;
  // נייד (10 ספרות): 05X-XXX-XXXX · קווי (9 ספרות): 0X-XXX-XXXX
  if (local.length === 10) {
    return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (local.length === 9) {
    return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  }
  return local;
}
