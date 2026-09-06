import { prisma } from '@/lib/db';
import { normalizePhone } from '@/lib/crypto';
import type { Prisma } from '@prisma/client';

/**
 * userId must come from a verified server session, never submitted booking fields.
 * Contact assertions are not ownership proof: every guest gets a separate unlinked
 * record, and legacy records require an explicit proof-of-ownership migration.
 * Passing the booking transaction keeps guest contact creation atomic with booking.
 *
 * Migration: leave identityVerifiedAt NULL on every preexisting record, including
 * records with userId. Never backfill it from matching phone/email or an existing
 * userId: the old linking path accepted guest assertions. Restore access only after
 * independently proving ownership of the selected appointments; split legacy
 * mixed-owner records before attaching userId and recording the verification time.
 */
export async function findOrCreateClient(params: {
  businessId: string;
  phone?: string | null;
  email?: string | null;
  name: string;
  userId?: string;
}, db: Prisma.TransactionClient = prisma) {
  const phone = params.phone ?? undefined;
  const email = params.email ?? undefined;
  if (!phone && !email && !params.userId) {
    throw new Error('findOrCreateClient: requires at least one of phone/email/userId');
  }

  if (params.userId) {
    const existing = await db.client.findFirst({
      where: {
        businessId: params.businessId,
        userId: params.userId,
        identityVerifiedAt: { not: null },
      },
    });
    if (existing) return existing;
  }

  // Contact matching may deny a booking, but must never grant access or reuse
  // another person's record. Preserve existing blocked-contact booking policy.
  const blockedContacts: Prisma.ClientWhereInput[] = [
    ...(phone ? [{ phone }] : []),
    ...(email ? [{ email }] : []),
    ...(params.userId ? [{ userId: params.userId }] : []),
  ];
  const blocked = await db.client.findFirst({
    where: { businessId: params.businessId, blocked: true, OR: blockedContacts },
    select: { id: true },
  });

  return db.client.create({
    data: {
      businessId: params.businessId,
      phone: phone ?? null,
      email: email ?? null,
      name: params.name,
      userId: params.userId,
      identityVerifiedAt: params.userId ? new Date() : null,
      blocked: Boolean(blocked),
    },
  });
}

export type ClientFilter = 'all' | 'active' | 'blocked';

/** רשימת לקוחות עם חיפוש חופשי (שם/טלפון) וסינון לפי מצב חסימה. */
export function listClients(
  businessId: string,
  opts: { q?: string; filter?: ClientFilter } = {},
) {
  const { q, filter = 'all' } = opts;
  const where: Prisma.ClientWhereInput = { businessId };

  if (filter === 'active') where.blocked = false;
  else if (filter === 'blocked') where.blocked = true;

  const term = q?.trim();
  if (term) {
    // הטלפונים נשמרים בפורמט E.164 (‎+9725...), לכן מנקים את מונח החיפוש לספרות
    // ומורידים אפס מוביל כדי שחיפוש כמו "050-123" יתאים ל-‎+97250...‎.
    const digits = term.replace(/\D/g, '').replace(/^0/, '');
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
    ];
  }

  return prisma.client.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { _count: { select: { appointments: true } } },
  });
}

/** לקוח בודד בתוך העסק (ללא היסטוריה). */
export function getClientById(businessId: string, id: string) {
  return prisma.client.findFirst({ where: { id, businessId } });
}

/** פרופיל לקוח כולל היסטוריית תורים, מסונן לפי העסק. */
export function getClientWithHistory(businessId: string, id: string) {
  return prisma.client.findFirst({
    where: { id, businessId },
    include: {
      appointments: {
        orderBy: { startAt: 'desc' },
        include: { services: true, staff: true },
      },
    },
  });
}

export type ClientInput = {
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
};

/** יצירת לקוח חדש. הטלפון מנורמל ל-E.164. */
export function createClient(businessId: string, data: ClientInput) {
  return prisma.client.create({
    data: {
      businessId,
      name: data.name,
      phone: normalizePhone(data.phone),
      email: data.email ?? null,
      notes: data.notes ?? null,
    },
  });
}

/** עדכון פרטי לקוח (מסונן לפי העסק כדי למנוע גישה חוצה עסקים). */
export async function updateClient(
  businessId: string,
  id: string,
  data: ClientInput,
) {
  const result = await prisma.client.updateMany({
    where: { id, businessId },
    data: {
      name: data.name,
      phone: normalizePhone(data.phone),
      email: data.email ?? null,
      notes: data.notes ?? null,
    },
  });
  return result.count > 0;
}

/** חסימה או שחרור של לקוח. */
export async function setClientBlocked(
  businessId: string,
  id: string,
  blocked: boolean,
) {
  const result = await prisma.client.updateMany({
    where: { id, businessId },
    data: { blocked },
  });
  return result.count > 0;
}
