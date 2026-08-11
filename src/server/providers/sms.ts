/**
 * שכבת תאימות לאחור לספק ה-SMS.
 *
 * המימוש האמיתי חי כעת ב-`messaging.ts` (שכבה אגנוסטית-ערוץ). קובץ זה נשמר
 * כ-alias דק כדי שקוד קיים (marketing, waitlist, מסלול ה-OTP) ימשיך לעבוד
 * ללא שינוי. קוד חדש עדיף שייבא ישירות מ-`@/server/providers/messaging`.
 */
import {
  getMessagingProvider,
  type MessagingProvider,
} from '@/server/providers/messaging';

/** ממשק ספק ה-SMS ההיסטורי. MessagingProvider הוא על-קבוצה שלו. */
export type SmsProvider = MessagingProvider;

/** בחירת ספק ה-SMS לפי משתנה הסביבה SMS_PROVIDER (מאציל ל-messaging). */
export function getSmsProvider(): SmsProvider {
  return getMessagingProvider();
}
