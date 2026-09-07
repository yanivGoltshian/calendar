import { createHash, randomUUID } from 'node:crypto';
import type { MessageLog, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { emailConfigured, sendEmail } from '@/server/providers/email';
import { canDeliverClientEmail } from './deliveryPolicy';

export type EmailDeliveryResult =
  | { status: 'sent'; duplicate?: boolean }
  | { status: 'blocked' | 'failed' | 'unknown'; reason: string };

type OutboxRow = Pick<MessageLog, 'id' | 'status' | 'error' | 'reservedAt'>;
type OutboxTransaction = {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  messageLog: {
    findUnique(args: { where: { idempotencyKey: string } }): Promise<OutboxRow | null>;
    create(args: { data: Prisma.MessageLogUncheckedCreateInput }): Promise<OutboxRow>;
    update(args: { where: { id: string }; data: Prisma.MessageLogUncheckedUpdateInput }): Promise<OutboxRow>;
    updateMany(args: Prisma.MessageLogUpdateManyArgs): Promise<Prisma.BatchPayload>;
  };
};
export type EmailDeliveryDeps = {
  send?: typeof sendEmail;
  configured?: boolean;
  canDeliverEmail?: typeof canDeliverClientEmail;
  now?: () => Date;
  prismaClient?: {
    $transaction<T>(work: (tx: OutboxTransaction) => Promise<T>): Promise<T>;
    messageLog: OutboxTransaction['messageLog'];
  };
};
const PREPARATION_LEASE_MS = 5 * 60 * 1000;

/** Durable per-recipient outbox claim. SMTP has no idempotency API: never reclaim
 * an ambiguous accepted/in-flight message automatically. */
export async function deliverEmailOnce(
  req: {
    businessId: string; appointmentId?: string; clientId?: string | null; campaignId?: string;
    idempotencyKey: string; to: string; subject: string; text: string; html?: string;
  },
  deps: EmailDeliveryDeps = {},
): Promise<EmailDeliveryResult> {
  const db: NonNullable<EmailDeliveryDeps['prismaClient']> = deps.prismaClient ?? prisma;
  const eligible = async () => await (deps.canDeliverEmail ?? canDeliverClientEmail)(req.businessId, req.appointmentId) &&
    (!req.campaignId || !!await prisma.campaign.findFirst({
      where: { id: req.campaignId, businessId: req.businessId, status: 'SENDING' },
    }));
  if (!(deps.configured ?? emailConfigured)) return { status: 'blocked', reason: 'email_not_configured' };
  if (!await eligible()) {
    await db.messageLog.create({ data: {
      businessId: req.businessId, channel: 'email', address: req.to, body: req.text,
      status: 'BLOCKED', error: 'email_entitlement_denied', countsToCap: false,
    } });
    return { status: 'blocked', reason: 'email_entitlement_denied' };
  }
  const key = createHash('sha256').update(JSON.stringify([req.businessId, 'email', req.to.toLowerCase(), req.idempotencyKey])).digest('hex');
  const owner = randomUUID();
  const preparing = `preparing:${owner}`;
  const dispatching = `dispatching:${owner}`;
  const reservation = await db.$transaction(async (tx): Promise<
    { owned: true; id: string } | { owned: false; result: EmailDeliveryResult }
  > => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    const now = (deps.now ?? (() => new Date()))();
    const existing = await tx.messageLog.findUnique({ where: { idempotencyKey: key } });
    if (existing?.status === 'SENT') return { owned: false, result: { status: 'sent', duplicate: true } };
    if (existing && existing.status !== 'FAILED') {
      // Legacy "claimed" also precedes dispatch. Changing its marker fences the
      // legacy sender's CAS. Dispatching/UNKNOWN rows never expire automatically.
      const preparatory = existing.status === 'RESERVED' &&
        (existing.error?.startsWith('preparing:') || existing.error === 'claimed');
      if (!preparatory) return { owned: false, result: { status: 'unknown', reason: 'delivery_outcome_unknown' } };
      if (!existing.reservedAt || existing.reservedAt.getTime() > now.getTime() - PREPARATION_LEASE_MS) {
        return { owned: false, result: { status: 'failed', reason: 'preparation_in_progress' } };
      }
    }
    const data = {
      businessId: req.businessId, clientId: req.clientId ?? null, campaignId: req.campaignId ?? null,
      channel: 'email', address: req.to, body: req.text, status: 'RESERVED' as const,
      countsToCap: false, reservedAt: now, error: preparing,
    };
    if (existing) {
      // Dispatch does not take the advisory lock. Fence the read→reclaim race
      // with the exact state observed, so a newly dispatching owner cannot be stolen.
      const reclaimed = await tx.messageLog.updateMany({
        where: { id: existing.id, status: existing.status, error: existing.error, reservedAt: existing.reservedAt },
        data,
      });
      return reclaimed.count
        ? { owned: true, id: existing.id }
        : { owned: false, result: { status: 'failed', reason: 'preparation_claim_lost' } };
    }
    const row = await tx.messageLog.create({ data: { ...data, idempotencyKey: key } });
    return { owned: true, id: row.id };
  });
  if (!reservation.owned) return reservation.result;
  const ownedPreparation = { id: reservation.id, status: 'RESERVED' as const, error: preparing };
  const releasePreparation = (reason: string) => db.messageLog.updateMany({
    where: ownedPreparation, data: { status: 'FAILED', error: reason },
  }).catch(() => undefined);
  let allowed: boolean;
  try {
    allowed = await eligible();
  } catch {
    // Failed cleanup leaves an owned preparatory lease, not an ambiguous send.
    await releasePreparation('preparation_failed');
    return { status: 'failed', reason: 'preparation_failed' };
  }
  if (!allowed) {
    await releasePreparation('lifecycle_changed');
    return { status: 'blocked', reason: 'lifecycle_changed' };
  }
  const ownedDispatch = { id: reservation.id, status: 'RESERVED' as const, error: dispatching };
  try {
    const claimed = await db.messageLog.updateMany({
      where: ownedPreparation, data: { error: dispatching },
    });
    if (!claimed.count) return { status: 'failed', reason: 'preparation_claim_lost' };
  } catch {
    // The transition may have committed despite a lost DB response. No provider
    // has been invoked here, so this owner alone may undo either of its markers.
    try {
      const released = await db.messageLog.updateMany({
        where: { id: reservation.id, status: 'RESERVED', error: { in: [preparing, dispatching] } },
        data: { status: 'FAILED', error: 'preparation_failed' },
      });
      if (released.count) return { status: 'failed', reason: 'preparation_failed' };
    } catch { /* A possibly committed dispatch transition must remain quarantined. */ }
    return { status: 'unknown', reason: 'delivery_outcome_unknown' };
  }
  try {
    await (deps.send ?? sendEmail)(req.to, req.subject, req.text, req.html);
  } catch (error) {
    // SMTP rejections before DATA/connection are retryable. Network/unknown
    // failures can follow acceptance and need operator reconciliation.
    const code = (error as NodeJS.ErrnoException)?.code;
    const rejected = ['EAUTH', 'EENVELOPE', 'ECONNECTION', 'ECONNREFUSED', 'ENOTFOUND'].includes(code ?? '');
    await db.messageLog.updateMany({
      where: ownedDispatch, data: { status: rejected ? 'FAILED' : 'UNKNOWN', error: rejected ? 'provider_rejected' : 'delivery_outcome_unknown' },
    }).catch(() => undefined);
    return { status: rejected ? 'failed' : 'unknown', reason: rejected ? 'provider_rejected' : 'delivery_outcome_unknown' };
  }
  try {
    const finalized = await db.messageLog.updateMany({ where: ownedDispatch, data: { status: 'SENT', error: null } });
    if (!finalized.count) return { status: 'unknown', reason: 'delivery_outcome_unknown' };
  } catch {
    return { status: 'unknown', reason: 'delivery_outcome_unknown' };
  }
  return { status: 'sent' };
}
