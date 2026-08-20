import { resolveBrandColor, readableText } from '@/lib/brandColor';

/**
 * מודל טהור לכרטיס השיתוף (OG) של עסק — מפריד את ההחלטה הוויזואלית
 * מרינדור התמונה עצמה (ImageResponse), כדי שנוכל לבדוק אותו ביחידה.
 *
 * mode='logo' כאשר סופק לוגו טעון (data URI/כתובת); אחרת נופלים לאות
 * ראשונה על רקע צבע המותג. background/fg נגזרים מצבע המותג (עם נפילה
 * לצבע תור צ׳יק) ומצבע טקסט קריא מעליו.
 */

export type BusinessOgMode = 'logo' | 'initial';

export type BusinessOgModel = {
  /** צבע רקע הכרטיס — hex תקין (צבע המותג של העסק, עם נפילה). */
  background: string;
  /** צבע טקסט קריא (לבן/כהה) מעל הרקע. */
  fg: string;
  /** מצב הרינדור: לוגו כשקיים, אחרת אות ראשונה. */
  mode: BusinessOgMode;
  /** אות הנפילה (התו הראשון של שם העסק) לשימוש כשאין לוגו. */
  initial: string;
};

export type BusinessOgInput = {
  name?: string | null;
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
  const mode: BusinessOgMode = input.logoUrl ? 'logo' : 'initial';
  return { background, fg, mode, initial };
}
