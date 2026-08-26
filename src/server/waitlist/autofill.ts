/**
 * מילוי אוטומטי של תור שהתפנה מתוך רשימת ההמתנה (auto-fill).
 *
 * הזרימה: כשתור מבוטל, נגזרת ממנו "משבצת שהתפנתה" (FreedSlot), מדרגים את הממתינים
 * הכשירים (WAITING) לפי ותק, ומציעים למוביל בתור החזקה בלעדית קצרת-מועד עם טוקן
 * תפיסה (claim) וקישור. ההודעה נשלחת דרך שכבת ההודעות/תזכורות הקיימת (WhatsApp מאחורי
 * דגל התכונה remindersEnabled, עם נפילה למייל), ולעולם אינה זורקת — כשל שליחה אינו
 * מבטל את ההחזקה, כך שה"תור" נשמר וניתן להציעו שוב (queue). אם המשבצת נחטפה בינתיים
 * (הוזמנה ישירות) — לא מציעים. בפקיעת ההחזקה, ה-sweep מריץ את הטריגר שוב ומציע לבא בתור.
 *
 * המודול בנוי סביב הזרקת-תלויות (deps) כדי שהלוגיקה תהיה ניתנת לבדיקה ללא בסיס נתונים.
 */

import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/db';
import { t } from '@/i18n';
import { absoluteUrl } from '@/lib/seo';
import { DEFAULT_TZ, utcToLocalParts, formatDateString } from '@/lib/time';
import {
  getMessagingProvider,
  MessagingConfigError,
} from '@/server/providers/messaging';
import { emailConfigured, sendReminderEmail } from '@/server/providers/email';
import {
  resolveReminderChannel,
  type ResolvableClient,
} from '@/server/reminders/resolveChannel';
import { rankWaitlistMatches, type FreedSlot, type WaitlistCandidate } from './match';
import {
  findWaitingCandidatesForBusiness,
  getWaitlistEntryForBusiness,
  setHoldForEntry,
  markWaitlistNotified,
} from '@/server/repos/waitlist';

/** משך ה"החזקה" הבלעדית בדקות (הטווח שביקש הרכז: 15–30). */
export const HOLD_MINUTES = 20;

// ----------------------- טיפוסים טהורים -----------------------

/** מקור נתונים מינימלי לגזירת FreedSlot מתור שבוטל (תת-קבוצה של Appointment). */
export type FreedSlotSource = {
  startAt: Date;
  endAt: Date;
  staffId: string;
  services: { serviceId: string }[];
};

/**
 * גזירת המשבצת שהתפנתה מתוך תור (זמנים מקומיים בדקות). פונקציה טהורה — נבדקת ביחידה.
 */
export function deriveFreedSlotFromAppointment(
  appt: FreedSlotSource,
  timeZone: string = DEFAULT_TZ,
): FreedSlot {
  const start = utcToLocalParts(appt.startAt, timeZone);
  const end = utcToLocalParts(appt.endAt, timeZone);
  return {
    serviceIds: appt.services.map((s) => s.serviceId),
    staffId: appt.staffId,
    dateStr: formatDateString(appt.startAt, timeZone),
    startMinute: start.minutes,
    endMinute: end.minutes,
  };
}

// ----------------------- שכבת שליחה (לעולם לא זורקת) -----------------------

export type WaitlistSendResult =
  | { status: 'sent'; channel: 'WHATSAPP' | 'EMAIL' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; channel: 'WHATSAPP' | 'EMAIL'; error: string };

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** עטיפת HTML בעברית (RTL) לגוף ההודעה, זהה בסגנון לשכבת התזכורות. */
function offerHtml(body: string): string {
  return (
    `<!doctype html><html lang="he" dir="rtl"><body style="font-family:Arial,Helvetica,sans-serif;text-align:right;direction:rtl">` +
    `<p>${escapeHtml(body)}</p>` +
    `</body></html>`
  );
}

export type OfferSendParams = {
  email: string | null;
  phone: string | null;
  channelPref: string;
  remindersEnabled: boolean;
  subject: string;
  body: string;
};

/**
 * שליחת הודעת ההצעה. WhatsApp מאחורי דגל remindersEnabled, עם נפילה למייל לפי זהות
 * הלקוח (resolveReminderChannel). לעולם אינה זורקת — כל כשל מוחזר כתוצאה מובנית.
 */
export async function sendWaitlistOffer(
  params: OfferSendParams,
): Promise<WaitlistSendResult> {
  // דגל התכונה: כשכבוי, לא שולחים — ההחזקה/הקישור נשמרים (queue) ואפשר להציע ידנית.
  if (!params.remindersEnabled) {
    return { status: 'skipped', reason: 'reminders disabled' };
  }

  const client: ResolvableClient = { email: params.email, phone: params.phone };
  const resolved = resolveReminderChannel(client, params.channelPref);
  if (resolved.kind === 'skip') {
    return { status: 'skipped', reason: resolved.reason };
  }

  // ערוץ מייל: רק אם ספק המייל מוגדר בפועל (אחרת נדלג בחן, לא נדַווח "נשלח").
  if (resolved.channel === 'EMAIL') {
    if (!emailConfigured) {
      return { status: 'skipped', reason: 'email provider not configured' };
    }
    try {
      await sendReminderEmail(resolved.to, params.subject, params.body, offerHtml(params.body));
      return { status: 'sent', channel: 'EMAIL' };
    } catch (err) {
      return { status: 'failed', channel: 'EMAIL', error: errText(err) };
    }
  }

  // ערוץ "SMS" נמסר בפועל דרך WhatsApp (הספק המשותף) — אין ערוץ SMS בתשלום.
  let provider: ReturnType<typeof getMessagingProvider>;
  try {
    provider = getMessagingProvider();
  } catch (err) {
    if (err instanceof MessagingConfigError) {
      return { status: 'skipped', reason: err.message };
    }
    return { status: 'failed', channel: 'WHATSAPP', error: errText(err) };
  }
  try {
    await provider.sendWhatsApp(resolved.to, params.body);
    return { status: 'sent', channel: 'WHATSAPP' };
  } catch (err) {
    if (err instanceof MessagingConfigError) {
      return { status: 'skipped', reason: err.message };
    }
    return { status: 'failed', channel: 'WHATSAPP', error: errText(err) };
  }
}

function buildOfferBody(name: string, businessName: string, url: string): string {
  return t.waitlist.offer.body
    .replace('{name}', name.trim() || '')
    .replace('{business}', businessName)
    .replace('{url}', url);
}

// ----------------------- אורקסטרציה (עם הזרקת תלויות) -----------------------

export type AutofillAppointment = {
  id: string;
  businessId: string;
  staffId: string;
  startAt: Date;
  endAt: Date;
  status: string;
  services: { serviceId: string }[];
};

export type AutofillBusiness = {
  name: string;
  timezone: string | null;
  remindersEnabled: boolean;
  reminderChannel: string;
};

export type AutofillContact = { name: string; phone: string; email: string | null };

export type HoldInput = {
  claimToken: string;
  holdExpiresAt: Date;
  heldAppointmentId: string | null;
};

export type AutofillDeps = {
  getAppointment(id: string): Promise<AutofillAppointment | null>;
  getBusiness(businessId: string): Promise<AutofillBusiness | null>;
  getCandidates(businessId: string): Promise<WaitlistCandidate[]>;
  slotHasConflict(staffId: string, startAt: Date, endAt: Date): Promise<boolean>;
  setHold(entryId: string, input: HoldInput): Promise<boolean>;
  loadContact(businessId: string, entryId: string): Promise<AutofillContact | null>;
  send(params: OfferSendParams): Promise<WaitlistSendResult>;
  now(): Date;
  makeToken(): string;
};

/** תלויות ברירת המחדל — מחוברות ל-DB ולשכבת ההודעות האמיתית. */
export const defaultDeps: AutofillDeps = {
  async getAppointment(id) {
    const appt = await prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        businessId: true,
        staffId: true,
        startAt: true,
        endAt: true,
        status: true,
        services: { select: { serviceId: true } },
      },
    });
    return appt as AutofillAppointment | null;
  },
  async getBusiness(businessId) {
    const b = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        timezone: true,
        settings: { select: { remindersEnabled: true, reminderChannel: true } },
      },
    });
    if (!b) return null;
    return {
      name: b.name,
      timezone: b.timezone,
      remindersEnabled: b.settings?.remindersEnabled ?? true,
      reminderChannel: b.settings?.reminderChannel ?? 'AUTO',
    };
  },
  getCandidates(businessId) {
    return findWaitingCandidatesForBusiness(businessId);
  },
  async slotHasConflict(staffId, startAt, endAt) {
    // ייבוא עצל כדי לשמור על ניתוק מהריפו לצורכי הזרקה בבדיקות.
    const { hasConflict } = await import('@/server/repos/appointments');
    return hasConflict(staffId, startAt, endAt);
  },
  setHold(entryId, input) {
    return setHoldForEntry(entryId, input);
  },
  async loadContact(businessId, entryId) {
    const entry = await getWaitlistEntryForBusiness(businessId, entryId);
    if (!entry) return null;
    return { name: entry.name, phone: entry.phone, email: entry.client?.email ?? null };
  },
  send(params) {
    return sendWaitlistOffer(params);
  },
  now() {
    return new Date();
  },
  makeToken() {
    return randomUUID();
  },
};

export type AutofillOutcome =
  | { offered: false; reason: string }
  | {
      offered: true;
      entryId: string;
      claimToken: string;
      holdExpiresAt: Date;
      send: WaitlistSendResult;
    };

/**
 * הטריגר המרכזי: בהינתן מזהה תור שבוטל, מציע את המשבצת שהתפנתה למוביל הכשיר ברשימה.
 * מחזיר תוצאה מובנית (offered/reason) ולעולם אינו זורק כלפי הקורא בזרימת ביטול.
 */
export async function triggerWaitlistAutofillForAppointment(
  appointmentId: string,
  deps: AutofillDeps = defaultDeps,
): Promise<AutofillOutcome> {
  const appt = await deps.getAppointment(appointmentId);
  if (!appt) return { offered: false, reason: 'appointment_not_found' };
  // מציעים רק ממשבצת שאכן התפנתה (התור בוטל).
  if (appt.status !== 'CANCELLED') return { offered: false, reason: 'not_cancelled' };

  const business = await deps.getBusiness(appt.businessId);
  const tz = business?.timezone || DEFAULT_TZ;
  const businessName = business?.name ?? '';

  // אם המשבצת כבר נחטפה (הוזמנה ישירות בינתיים) — אין מה להציע.
  if (await deps.slotHasConflict(appt.staffId, appt.startAt, appt.endAt)) {
    return { offered: false, reason: 'slot_taken' };
  }

  const slot = deriveFreedSlotFromAppointment(appt, tz);
  const candidates = await deps.getCandidates(appt.businessId);
  const ranked = rankWaitlistMatches(candidates, slot);
  if (ranked.length === 0) return { offered: false, reason: 'no_match' };

  const holdExpiresAt = new Date(deps.now().getTime() + HOLD_MINUTES * 60_000);

  // מנסים מהמוביל ומטה — אם setHold נכשל (מרוץ עם טריגר אחר) עוברים לבא בתור.
  for (const candidate of ranked) {
    const claimToken = deps.makeToken();
    const held = await deps.setHold(candidate.id, {
      claimToken,
      holdExpiresAt,
      heldAppointmentId: appt.id,
    });
    if (!held) continue;

    const contact = await deps.loadContact(appt.businessId, candidate.id);
    const url = absoluteUrl(`/w/${claimToken}`);
    const send = await deps.send({
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      channelPref: business?.reminderChannel ?? 'AUTO',
      remindersEnabled: business?.remindersEnabled ?? true,
      subject: t.waitlist.offer.subject.replace('{business}', businessName),
      body: buildOfferBody(contact?.name ?? '', businessName, url),
    });

    return { offered: true, entryId: candidate.id, claimToken, holdExpiresAt, send };
  }

  return { offered: false, reason: 'hold_race_lost' };
}

/**
 * יידוע ידני מאזור הניהול (ללא תור ספציפי שהתפנה): מסמן NOTIFIED ושולח הודעה כללית
 * ("התפנה מקום, ניצור קשר"). ללא טוקן/החזקה — הבעלים מתאם ידנית. לעולם אינו זורק.
 */
export async function offerWaitlistEntryManually(
  businessId: string,
  entryId: string,
  deps: AutofillDeps = defaultDeps,
): Promise<{ ok: true; send: WaitlistSendResult } | { ok: false; reason: string }> {
  const marked = await markWaitlistNotified(businessId, entryId);
  if (!marked) return { ok: false, reason: 'not_waiting' };

  const business = await deps.getBusiness(businessId);
  const contact = await deps.loadContact(businessId, entryId);
  const businessName = business?.name ?? '';
  const body = t.waitlist.offer.manualBody
    .replace('{name}', contact?.name?.trim() || '')
    .replace('{business}', businessName);

  const send = await deps.send({
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
    channelPref: business?.reminderChannel ?? 'AUTO',
    remindersEnabled: business?.remindersEnabled ?? true,
    subject: t.waitlist.offer.subject.replace('{business}', businessName),
    body,
  });
  return { ok: true, send };
}
