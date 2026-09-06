import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const LEASE_MS = 5 * 60 * 1000;
const TOLERANCE_MS = 15 * 60 * 1000;
const policyInclude = { business: { include: { settings: true } }, reminders: true } satisfies Prisma.AppointmentInclude;
type ReminderPolicy = Prisma.AppointmentGetPayload<{ include: typeof policyInclude }>;

async function lockedPolicy(tx: Prisma.TransactionClient, id: string) {
  // Also serializes missing-intent creation: there is no unique reminder-per-appointment constraint.
  await tx.$queryRaw`SELECT "id" FROM "Appointment" WHERE "id" = ${id} FOR UPDATE`;
  return tx.appointment.findUnique({ where: { id }, include: policyInclude });
}

function currentDueAt(appt: ReminderPolicy, now: Date): Date | null {
  const { business } = appt;
  const lead = business.settings?.reminderLeadHours ?? 24;
  if (appt.status !== 'CONFIRMED' || appt.reminderSentAt || appt.startAt <= now ||
      business.accountStatus !== 'ACTIVE' || !['premium', 'exclusive'].includes(business.plan) ||
      !business.paidUntil || business.paidUntil <= now || business.settings?.remindersEnabled === false ||
      !Number.isInteger(lead) || lead < 0 || lead > 168 ||
      appt.reminders.some((row) => row.status === 'SENT' || row.status === 'CANCELLED') ||
      appt.reminderLastError === 'delivery_outcome_unknown') return null;
  return new Date(appt.startAt.getTime() - lead * 3600000);
}

async function reconcileIntent(tx: Prisma.TransactionClient, appt: ReminderPolicy, sendAt: Date) {
  if (!appt.reminders.length) {
    await tx.reminder.create({ data: { appointmentId: appt.id, channel: 'AUTO', sendAt } });
  } else {
    await tx.reminder.updateMany({
      where: { appointmentId: appt.id, status: { in: ['SCHEDULED', 'FAILED'] } },
      data: { sendAt, status: 'SCHEDULED' },
    });
  }
}

export async function claimReminder(id: string, now = new Date()): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const appt = await lockedPolicy(tx, id);
    if (!appt) return null;
    const expired = !!appt.reminderClaimedAt && appt.reminderClaimedAt.getTime() < now.getTime() - LEASE_MS;
    if (expired && appt.reminderLastError === 'dispatching') {
      await tx.appointment.update({ where: { id }, data: { reminderLastError: 'delivery_outcome_unknown' } });
      return null;
    }
    if (appt.reminderClaimToken && !(expired && appt.reminderLastError === 'claimed')) return null;
    const sendAt = currentDueAt(appt, now);
    if (!sendAt) return null;
    await reconcileIntent(tx, appt, sendAt);
    if (sendAt.getTime() > now.getTime() + TOLERANCE_MS) return null;
    const token = randomUUID();
    await tx.appointment.update({
      where: { id },
      data: { reminderClaimToken: token, reminderClaimedAt: now, reminderLastError: 'claimed' },
    });
    return token;
  });
}

export async function beginReminderDispatch(id: string, token: string): Promise<boolean> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const appt = await lockedPolicy(tx, id);
    if (!appt || appt.reminderClaimToken !== token || appt.reminderLastError !== 'claimed') return false;
    const sendAt = currentDueAt(appt, now);
    if (!sendAt) return false;
    await reconcileIntent(tx, appt, sendAt);
    if (sendAt.getTime() > now.getTime() + TOLERANCE_MS) return false;
    await tx.appointment.update({
      where: { id }, data: { reminderLastError: 'dispatching', reminderClaimedAt: now },
    });
    return true;
  });
}

export async function completeReminder(id: string, token: string, sentAt = new Date()) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.appointment.updateMany({
      where: { id, reminderClaimToken: token, reminderSentAt: null },
      data: { reminderSentAt: sentAt, reminderClaimToken: null, reminderClaimedAt: null, reminderLastError: null },
    });
    if (result.count) await tx.reminder.updateMany({
      where: { appointmentId: id, status: 'SCHEDULED' }, data: { status: 'SENT', sentAt },
    });
    return result.count;
  });
}

export async function releaseReminder(id: string, token: string, error: string, uncertain = false) {
  await prisma.appointment.updateMany({
    where: { id, reminderClaimToken: token, reminderSentAt: null },
    data: uncertain ? { reminderLastError: 'delivery_outcome_unknown' }
      : { reminderClaimToken: null, reminderClaimedAt: null, reminderLastError: error.slice(0, 200) },
  });
}
