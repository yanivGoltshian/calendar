import { prisma } from '@/lib/db';
import { normalizePhone } from '@/lib/crypto';
import type { Prisma } from '@prisma/client';

/**
 * מציאת לקוח לפי טלפון בעסק, או יצירתו אוטומטית (upsert).
 * מקשר למשתמש אם התקבל userId.
 */
export async function findOrCreateClient(params: {
  businessId: string;
  phone: string;
  name: string;
  userId?: string;
}) {
  const existing = await prisma.client.findUnique({
    where: { businessId_phone: { businessId: params.businessId, phone: params.phone } },
  });
  if (existing) {
    // עדכון שם/קישור משתמש אם חסרים.
    if ((!existing.userId && params.userId) || (!existing.name && params.name)) {
      return prisma.client.update({
        where: { id: existing.id },
        data: {
          userId: existing.userId ?? params.userId,
          name: existing.name || params.name,
        },
      });
    }
    return existing;
  }
  return prisma.client.create({
    data: {
      businessId: params.businessId,
      phone: params.phone,
      name: params.name,
      userId: params.userId,
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
