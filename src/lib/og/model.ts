import { resolveBrandColor, readableText } from '@/lib/brandColor';

/**
 * מודל טהור לכרטיס השיתוף (OG) של עסק — מפריד את ההחלטה הוויזואלית
 * מרינדור התמונה עצמה (ImageResponse), כדי שנוכל לבדוק אותו ביחידה.
 *
 * סדר עדיפויות המצב: 'cover' כשסופקה תמונת עסק טעונה, אחרת 'logo' כשסופק
 * לוגו טעון, ואחרת נפילה ל-'initial' (אות ראשונה על רקע צבע המותג).
 * background/fg נגזרים מצבע המותג (עם נפילה לצבע תור צ׳יק) ומצבע טקסט
 * קריא מעליו, ומשמשים בעיקר את מצבי הנפילה.
 */

export type BusinessOgMode = 'cover' | 'logo' | 'initial';

/**
 * קריאה לפעולה קבועה בכרטיס — מזכירה שהליבה היא הזמנת תור אונליין
 * (זה מה שמוכרים), בכל מצבי הרינדור.
 */
export const OG_CTA = 'קביעת תור אונליין';

/**
 * תווית עברית לסוג העסק לכותרת המשנה בכרטיס. מוגדרת מקומית (ולא נשאבת מ-i18n
 * העמוק של הניהול) כדי לשמור את מודל ה-OG טהור, יציב וללא תלות במבנה התרגומים.
 * 'OTHER' => ריק: "אחר" חסר משמעות ככותרת משנה, ולכן פשוט לא מוצג.
 */
const BUSINESS_TYPE_LABEL_HE: Record<string, string> = {
  BARBERSHOP: 'מספרה לגברים',
  HAIR_SALON: 'מספרה',
  NAILS: 'ציפורניים',
  BEAUTY_COSMETICS: 'קוסמטיקה',
  SPA_MASSAGE: 'ספא ועיסוי',
  BROWS_LASHES: 'גבות וריסים',
  TATTOO_PIERCING: 'קעקועים ופירסינג',
  CLINIC: 'קליניקה',
  FITNESS: 'כושר',
  OTHER: '',
};

export type BusinessOgModel = {
  /** צבע רקע הכרטיס — hex תקין (צבע המותג של העסק, עם נפילה). */
  background: string;
  /** צבע טקסט קריא (לבן/כהה) מעל הרקע. */
  fg: string;
  /** מצב הרינדור: תמונת עסק כשקיימת, אחרת לוגו, ואחרת אות ראשונה. */
  mode: BusinessOgMode;
  /** אות הנפילה (התו הראשון של שם העסק) לשימוש כשאין לוגו. */
  initial: string;
  /** שם העסק בסדר לוגי — הרינדור ממיר אותו לסדר ויזואלי (toVisualOrder). */
  name: string;
  /** תווית סוג העסק בעברית (סדר לוגי); ריק כשלא ידוע/‏OTHER. */
  typeLabel: string;
  /** טקסט הקריאה לפעולה (סדר לוגי). */
  cta: string;
  /** עד שלושה שמות שירותים (סדר לוגי) להצגה כתגיות. */
  services: string[];
};

export type BusinessOgInput = {
  name?: string | null;
  /** תמונת עסק שכבר נטענה (data URI) או כתובת; מעדיפה על הלוגו כשקיימת. */
  coverUrl?: string | null;
  /** לוגו שכבר נטען (data URI) או כתובת; ריק/undefined => נפילה לאות. */
  logoUrl?: string | null;
  brandColor?: string | null;
  /** סוג העסק (BusinessType) לגזירת כותרת משנה; לא ידוע => בלי כותרת משנה. */
  type?: string | null;
  /** שמות שירותים גלויים (עד שלושה יוצגו כתגיות); ריקים מסוננים. */
  services?: (string | null | undefined)[] | null;
};

/** בונה את המודל הטהור של כרטיס ה-OG מנתוני המיתוג של העסק. */
export function buildBusinessOgModel(input: BusinessOgInput): BusinessOgModel {
  const background = resolveBrandColor(input.brandColor);
  const fg = readableText(background);
  const name = (input.name ?? '').trim();
  const initial = name.charAt(0) || '\u2022';
  const mode: BusinessOgMode = input.coverUrl ? 'cover' : input.logoUrl ? 'logo' : 'initial';
  const typeLabel = BUSINESS_TYPE_LABEL_HE[String(input.type ?? '').trim()] ?? '';
  const services = (input.services ?? [])
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);
  return { background, fg, mode, initial, name, typeLabel, cta: OG_CTA, services };
}
