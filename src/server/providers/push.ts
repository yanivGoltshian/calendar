/**
 * ממשק ספק התראות Push (Web Push / PWA).
 * כרגע stub בלבד; בעתיד יחובר ל-Web Push אמיתי עם VAPID.
 */
export interface PushProvider {
  sendPush(userId: string, title: string, body: string): Promise<void>;
}

class StubPushProvider implements PushProvider {
  async sendPush(userId: string, title: string, body: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`\n🔔 [PUSH → ${userId}] ${title}: ${body}\n`);
  }
}

let provider: PushProvider | null = null;

export function getPushProvider(): PushProvider {
  if (!provider) provider = new StubPushProvider();
  return provider;
}
