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

export type BusinessOgModel = {
  /** צבע רקע הכרטיס — hex תקין (צבע המותג של העסק, עם נפילה). */
  background: string;
  /** צבע טקסט קריא (לבן/כהה) מעל הרקע. */
  fg: string;
  /** מצב הרינדור: תמונת עסק כשקיימת, אחרת לוגו, ואחרת אות ראשונה. */
  mode: BusinessOgMode;
  /** אות הנפילה (התו הראשון של שם העסק) לשימוש כשאין לוגו. */
  initial: string;
};

export type BusinessOgInput = {
  name?: string | null;
  /** תמונת עסק שכבר נטענה (data URI) או כתובת; מעדיפה על הלוגו כשקיימת. */
  coverUrl?: string | null;
  /** לוגו שכבר נטען (data URI) או כתובת; ריק/undefined => נפילה לאות. */
  logoUrl?: string | null;
  brandColor?: string | null;
};

/** בונה את המודל הטהור של כרטיס ה-OG מנתוני המיתוג של העסק. */
export function buildBusinessOgModel(input: BusinessOgInput): BusinessOgModel {
  const background = resolveBrandColor(input.brandColor);
  const fg = readableText(background);
  const name = (input.name ?? '').trim();
  const initial = name.charAt(0) || '\u2022';
  const mode: BusinessOgMode = input.coverUrl ? 'cover' : input.logoUrl ? 'logo' : 'initial';
  return { background, fg, mode, initial };
}
