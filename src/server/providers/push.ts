/**
 * ספק התראות Web Push (PWA) לבעל העסק.
 *
 * עקרונות:
 *  - מיטבי לחלוטין: אף פעולה כאן אינה חוסמת ואינה זורקת החוצה. יצירת ההזמנה/הביטול
 *    כבר הושלמה לפני הקריאה, ולכן כשל פוש אינו משפיע על התהליך.
 *  - התדרדרות בחן: כשאין מפתחות VAPID בסביבה, נופלים ל-console (כמו ה-stub הקודם)
 *    בלי לזרוק ובלי לגעת במסד או בחבילת web-push.
 *  - ייבוא עצל: web-push ו-prisma מיובאים דינמית *בתוך* המתודה בלבד, כדי שייבוא
 *    המודול בבדיקות לא ידרוש חיבור מסד או את החבילה עצמה.
 */
export interface PushProvider {
  /** תאימות לאחור: פוש "פשוט" לפי מזהה חופשי (stub/console). */
  sendPush(userId: string, title: string, body: string): Promise<void>;
  /**
   * שליחת Web Push אמיתי לכל מנויי הדפדפן של העסק. מיטבי — מתדרדר ל-console כשאין
   * VAPID, גוזם מנויים מתים (404/410), ולעולם אינו זורק.
   */
  sendToBusiness(businessId: string, title: string, body: string, url?: string): Promise<void>;
}

type VapidConfig = { publicKey: string; privateKey: string; subject: string };

/** קריאת מפתחות VAPID מהסביבה. מחזיר null כשחסר מפתח ציבורי או פרטי. */
function readVapidConfig(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  // subject חייב להיות mailto: או URL. ברירת מחדל בטוחה כשלא סופק.
  const rawSubject = process.env.VAPID_SUBJECT?.trim();
  const subject = rawSubject && rawSubject.length > 0 ? rawSubject : 'mailto:notifications@torchick.app';
  return { publicKey, privateKey, subject };
}

class WebPushProvider implements PushProvider {
  async sendPush(userId: string, title: string, body: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`\n🔔 [PUSH → ${userId}] ${title}: ${body}\n`);
  }

  async sendToBusiness(businessId: string, title: string, body: string, url?: string): Promise<void> {
    const vapid = readVapidConfig();
    if (!vapid) {
      // אין VAPID — התדרדרות בחן ל-console, ללא גישה למסד או לחבילה.
      // eslint-disable-next-line no-console
      console.log(`\n🔔 [PUSH → business:${businessId}] ${title}: ${body}\n`);
      return;
    }

    try {
      const [{ default: webpush }, { prisma }] = await Promise.all([
        import('web-push'),
        import('@/lib/db'),
      ]);

      webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

      const subs = await prisma.pushSubscription.findMany({ where: { businessId } });
      if (subs.length === 0) return;

      const payload = JSON.stringify({ title, body, url: url ?? '/admin' });
      const deadEndpoints: string[] = [];

      await Promise.all(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            );
          } catch (err) {
            // 404/410 — המנוי בוטל בדפדפן; מסמנים לגזימה. יתר השגיאות רק מתועדות.
            const statusCode =
              typeof err === 'object' && err !== null && 'statusCode' in err
                ? (err as { statusCode?: number }).statusCode
                : undefined;
            if (statusCode === 404 || statusCode === 410) {
              deadEndpoints.push(sub.endpoint);
            } else {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[push:sendToBusiness] send failed — ${msg}`);
            }
          }
        }),
      );

      if (deadEndpoints.length > 0) {
        await prisma.pushSubscription
          .deleteMany({ where: { endpoint: { in: deadEndpoints } } })
          .catch(() => {});
      }
    } catch (err) {
      // כל כשל בלתי צפוי (ייבוא/מסד) אינו חוסם — רק מתועד.
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[push:sendToBusiness] unexpected failure — ${msg}`);
    }
  }
}

let provider: PushProvider | null = null;

export function getPushProvider(): PushProvider {
  if (!provider) provider = new WebPushProvider();
  return provider;
}
