import { BRAND } from '@/config/brand';

/**
 * ממשק ספק SMS. מאפשר החלפה עתידית בספק אמיתי (Twilio, Inforu וכו')
 * מבלי לשנות את שאר הקוד.
 */
export interface SmsProvider {
  sendSms(to: string, message: string): Promise<void>;
  sendOtp(to: string, code: string): Promise<void>;
}

/**
 * מימוש פיתוח: כותב את ההודעה ל-console בלבד.
 * לא מחייב שער SMS בתשלום בשלב זה.
 */
class ConsoleSmsProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`\n📱 [SMS → ${to}]\n${message}\n`);
  }

  async sendOtp(to: string, code: string): Promise<void> {
    const message = `${BRAND.name}: קוד האימות שלך הוא ${code}`;
    // eslint-disable-next-line no-console
    console.log(
      `\n════════════════════════════════════\n📱 קוד אימות ל-${to}: ${code}\n════════════════════════════════════\n`,
    );
    await this.sendSms(to, message);
  }
}

let provider: SmsProvider | null = null;

/** בחירת ספק ה-SMS לפי משתנה הסביבה SMS_PROVIDER. */
export function getSmsProvider(): SmsProvider {
  if (provider) return provider;
  // כרגע יש רק מימוש console; בעתיד אפשר להוסיף כאן ספקים אמיתיים.
  provider = new ConsoleSmsProvider();
  return provider;
}
