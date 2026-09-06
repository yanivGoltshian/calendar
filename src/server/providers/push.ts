import type { PushSubscription } from 'web-push';
import { permittedPushEndpoint, sendPinnedPush, type PushTransportDependencies } from './pushPolicy';

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
export type PushProviderDependencies = {
  vapid?: VapidConfig | null;
  subscriptions?: {
    list: (businessId: string) => Promise<Array<{ endpoint: string; p256dh: string; auth: string }>>;
    remove: (businessId: string, endpoints: string[]) => Promise<unknown>;
  };
  transport?: PushTransportDependencies;
};

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
  constructor(private readonly dependencies: PushProviderDependencies = {}) {}
  async sendPush(userId: string, title: string, body: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`\n🔔 [PUSH → ${userId}] ${title}: ${body}\n`);
  }

  async sendToBusiness(businessId: string, title: string, body: string, url?: string): Promise<void> {
    const vapid = this.dependencies.vapid === undefined ? readVapidConfig() : this.dependencies.vapid;
    if (!vapid) {
      // אין VAPID — התדרדרות בחן ל-console, ללא גישה למסד או לחבילה.
      // eslint-disable-next-line no-console
      console.log(`\n🔔 [PUSH → business:${businessId}] ${title}: ${body}\n`);
      return;
    }

    try {
      const { default: webpush } = await import('web-push');
      const subscriptions = this.dependencies.subscriptions ?? await (async () => {
        const { prisma } = await import('@/lib/db');
        return {
          list: (id: string) => prisma.pushSubscription.findMany({ where: { businessId: id } }),
          remove: (id: string, endpoints: string[]) => prisma.pushSubscription.deleteMany({
            where: { businessId: id, endpoint: { in: endpoints } },
          }),
        };
      })();
      const subs = await subscriptions.list(businessId);
      if (subs.length === 0) return;

      const payload = JSON.stringify({ title, body, url: url ?? '/admin' });
      const deadEndpoints: string[] = [];

      await Promise.all(
        subs.map(async (sub) => {
          try {
            // Stored rows predate the registration guard; never trust their endpoints.
            if (!permittedPushEndpoint(sub.endpoint)) throw new Error('push_origin');
            const subscription: PushSubscription = {
              endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth },
            };
            const details = webpush.generateRequestDetails(subscription, payload, { vapidDetails: vapid });
            await sendPinnedPush(details, this.dependencies.transport);
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
        await subscriptions.remove(businessId, deadEndpoints).catch(() => {});
      }
    } catch (err) {
      // כל כשל בלתי צפוי (ייבוא/מסד) אינו חוסם — רק מתועד.
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[push:sendToBusiness] unexpected failure — ${msg}`);
    }
  }
}

let provider: PushProvider | null = null;

export function createPushProvider(dependencies: PushProviderDependencies = {}): PushProvider {
  return new WebPushProvider(dependencies);
}

export function getPushProvider(): PushProvider {
  if (!provider) provider = createPushProvider();
  return provider;
}
