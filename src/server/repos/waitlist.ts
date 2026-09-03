import { prisma } from '@/lib/db';
import { sendGuardedSms } from '@/server/billing/costGuard';
import { sendReminderEmail } from '@/server/providers/email';
import { normalizePhone } from '@/lib/crypto';
import { BRAND } from '@/config/brand';
import {
  resolveWaitlistNotifyChannel,
  buildWaitlistNotifyEmail,
} from '@/server/repos/waitlistNotify';
import { renderMessage } from '@/server/messages/render';
import type { WaitlistStatus } from '@prisma/client';

/**
 * מודול רשימת המתנה (WaitlistEntry).
 * לוגיקה מעל השדות schema-בלבד שהורחבו: הוספה, צפייה, יידוע ללקוח (דרך ה-SMS stub),
 * קידום ידני וביטול. כל שאילתה מסוננת לפי businessId.
 */

/** רשימת ממתינים בעסק (אופציונלית לפי סטטוס), עם שירות/צוות/לקוח. סדר לפי ותק. */
export function listWaitlist(businessId: string, status?: WaitlistStatus) {
  return prisma.waitlistEntry.findMany({
    where: { businessId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      service: { select: { id: true, name: true } },
      staff: { select: { id: true, displayName: true } },
      client: { select: { id: true, name: true } },
    },
  });
}

export type AddWaitlistInput = {
  name: string;
  phone: string;
  /** אימייל אופציונלי — ערוץ יידוע נוסף ללקוח בחבילות ללא מסרון בתשלום. */
  email?: string | null;
  serviceId?: string | null;
  staffId?: string | null;
  clientId?: string | null;
  desiredDate?: string | null;
  /** חלון זמן מועדף — תחילת החלון בדקות מחצות (0–1439). אופציונלי. */
  earliestMinute?: number | null;
  /** חלון זמן מועדף — סוף החלון בדקות מחצות (0–1439). אופציונלי. */
  latestMinute?: number | null;
  note?: string | null;
};

/** הוספת ממתין חדש לרשימה. מנרמל טלפון ומאמת שיוך שירות/צוות/לקוח לעסק. */
export async function addWaitlistEntry(
  businessId: string,
  data: AddWaitlistInput,
): Promise<{ ok: true; id: string }> {
  let serviceId: string | null = null;
  if (data.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: data.serviceId, businessId },
      select: { id: true },
    });
    serviceId = service?.id ?? null;
  }

  let staffId: string | null = null;
  if (data.staffId) {
    const staff = await prisma.staffMember.findFirst({
      where: { id: data.staffId, businessId },
      select: { id: true },
    });
    staffId = staff?.id ?? null;
  }

  let clientId: string | null = null;
  if (data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, businessId },
      select: { id: true },
    });
    clientId = client?.id ?? null;
  }

  const created = await prisma.waitlistEntry.create({
    data: {
      businessId,
      name: data.name,
      phone: normalizePhone(data.phone),
      email: data.email?.trim() ? data.email.trim() : null,
      serviceId,
      staffId,
      clientId,
      desiredDate: data.desiredDate ?? null,
      earliestMinute: data.earliestMinute ?? null,
      latestMinute: data.latestMinute ?? null,
      note: data.note ?? null,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

/**
 * יידוע ממתין שהתפנה תור: שולח SMS דרך ה-stub ומעדכן סטטוס ל-NOTIFIED עם notifiedAt.
 * פועל על רשומה בסטטוס WAITING בלבד.
 */
export async function notifyWaitlistEntry(
  businessId: string,
  id: string,
  opts?: { isExclusive?: boolean },
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'not_waiting' }> {
  const entry = await prisma.waitlistEntry.findFirst({
    where: { id, businessId },
    include: { business: { select: { name: true } } },
  });
  if (!entry) return { ok: false, reason: 'not_found' };
  if (entry.status !== 'WAITING') return { ok: false, reason: 'not_waiting' };

  // ערוץ היידוע ללקוח נבחר לפי החבילה: מסרון בתשלום לאקסקלוסיב (דרך שער העלות), ובחבילות
  // ללא מסרון בתשלום — מייל "התפנה תור!" אם קיים אימייל ברשומה. בפרודקשן ספק ה-SMS במצב
  // console ולכן המייל הוא הערוץ שמגיע ללקוח בפועל. השליחה best-effort ולעולם אינה חוסמת
  // את מעבר הסטטוס ל-NOTIFIED.
  const channel = resolveWaitlistNotifyChannel({
    isExclusive: opts?.isExclusive,
    email: entry.email,
  });

  // משתני התבנית לנתיב הדריסה (משמשים רק כשקיימת דריסת-בעלים).
  const vars = {
    clientName: entry.name,
    businessName: entry.business?.name ?? '',
    brand: BRAND.name,
  };

  if (channel === 'sms') {
    const fallback = `${BRAND.name}: התפנה תור! ${entry.name}, נשמח לשמור לך מועד. השיבו להודעה זו לתיאום.`;
    const { text: message } = await renderMessage(
      businessId,
      'waitlist_freed',
      'sms',
      vars,
      { text: fallback },
    );
    await sendGuardedSms({
      businessId,
      to: entry.phone,
      body: message,
      clientId: entry.clientId,
      channel: 'sms',
    });
  } else if (channel === 'email' && entry.email) {
    // בליעה מכוונת: כשל SMTP אינו מפיל את היידוע ואינו חוסם את סימון NOTIFIED.
    try {
      const fb = buildWaitlistNotifyEmail(entry.name);
      const { subject, text, html } = await renderMessage(
        businessId,
        'waitlist_freed',
        'email',
        vars,
        fb,
      );
      await sendReminderEmail(entry.email, subject ?? fb.subject, text, html ?? fb.html);
    } catch {
      // best-effort — מתעלמים משגיאת שליחה.
    }
  }

  await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: 'NOTIFIED', notifiedAt: new Date() },
  });
  return { ok: true };
}

/** קידום ידני (הוזמן): מסמן BOOKED עם promotedAt. פועל על WAITING או NOTIFIED. */
export async function promoteWaitlistEntry(
  businessId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.waitlistEntry.updateMany({
    where: { id, businessId, status: { in: ['WAITING', 'NOTIFIED'] } },
    data: { status: 'BOOKED', promotedAt: new Date() },
  });
  return result.count > 0;
}

/** ביטול רשומה מרשימת ההמתנה (CANCELLED). */
export async function cancelWaitlistEntry(
  businessId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.waitlistEntry.updateMany({
    where: { id, businessId, status: { in: ['WAITING', 'NOTIFIED'] } },
    data: { status: 'CANCELLED' },
  });
  return result.count > 0;
}
