import { prisma } from '@/lib/db';
import { normalizePhone } from '@/lib/crypto';
import type { Prisma } from '@prisma/client';

/** רמת אימות זהות של לקוח (משפך אורח תחילה). */
export type VerificationLevel = 'VERIFIED' | 'UNVERIFIED' | 'NONE';

// דירוג רמות אימות לצורך "שדרוג בלבד" (לעולם לא מורידים רמה קיימת).
const verificationRank: Record<VerificationLevel, number> = { NONE: 0, UNVERIFIED: 1, VERIFIED: 2 };

/**
 * מציאת לקוח בעסק לפי זהות (userId / טלפון / מייל), או יצירתו אוטומטית.
 * לפחות אחד מבין phone/email/userId חייב להתקבל. שומר על תאימות לאחור: כאשר
 * מתקבל טלפון, האיתור מתבצע דרך המפתח הייחודי המורכב businessId_phone כמו קודם.
 */
export async function findOrCreateClient(params: {
  businessId: string;
  phone?: string | null;
  email?: string | null;
  name: string;
  userId?: string;
  verificationStatus?: VerificationLevel;
}) {
  const phone = params.phone ?? undefined;
  const email = params.email ?? undefined;
  if (!phone && !email && !params.userId) {
    throw new Error('findOrCreateClient: requires at least one of phone/email/userId');
  }

  // איתור לקוח קיים לפי הזהות הזמינה, לפי סדר עדיפויות.
  let existing = null;
  if (params.userId) {
    existing = await prisma.client.findFirst({
      where: { businessId: params.businessId, userId: params.userId },
    });
  }
  if (!existing && phone) {
    existing = await prisma.client.findUnique({
      where: { businessId_phone: { businessId: params.businessId, phone } },
    });
  }
  if (!existing && email) {
    existing = await prisma.client.findFirst({
      where: { businessId: params.businessId, email },
    });
  }

  if (existing) {
    // השלמת פרטים חסרים (קישור משתמש, שם, טלפון, מייל) אם התקבלו כעת.
    const patch: Prisma.ClientUpdateInput = {};
    if (!existing.userId && params.userId) patch.user = { connect: { id: params.userId } };
    if (!existing.name && params.name) patch.name = params.name;
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.email && email) patch.email = email;
    // רמת אימות: שדרוג בלבד (מחובר שמאמת לקוח קיים, או NONE שקיבל טלפון → UNVERIFIED).
    if (params.verificationStatus) {
      const current = verificationRank[existing.verificationStatus as VerificationLevel] ?? 0;
      const incoming = verificationRank[params.verificationStatus];
      if (incoming > current) patch.verificationStatus = params.verificationStatus;
    }
    if (Object.keys(patch).length > 0) {
      return prisma.client.update({ where: { id: existing.id }, data: patch });
    }
    return existing;
  }

  return prisma.client.create({
    data: {
      businessId: params.businessId,
      phone: phone ?? null,
      email: email ?? null,
      name: params.name,
      userId: params.userId,
      // ברירת מחדל בסכימה היא UNVERIFIED; מעבירים במפורש כדי לתעד NONE/VERIFIED.
      verificationStatus: params.verificationStatus ?? (phone ? 'UNVERIFIED' : 'NONE'),
    },
  });
}

export type ClientFilter = 'all' | 'active' | 'blocked' | 'unverified';

/** רשימת לקוחות עם חיפוש חופשי (שם/טלפון) וסינון לפי מצב חסימה. */
export function listClients(
  businessId: string,
  opts: { q?: string; filter?: ClientFilter } = {},
) {
  const { q, filter = 'all' } = opts;
  const where: Prisma.ClientWhereInput = { businessId };

  if (filter === 'active') where.blocked = false;
  else if (filter === 'blocked') where.blocked = true;
  else if (filter === 'unverified')
    where.verificationStatus = { in: ['UNVERIFIED', 'NONE'] };

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
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  verificationStatus?: VerificationLevel;
};

/** יצירת לקוח חדש. הטלפון מנורמל ל-E.164 (או null כשלא נמסר). */
export function createClient(businessId: string, data: ClientInput) {
  const phone = data.phone?.trim() ? normalizePhone(data.phone) : null;
  return prisma.client.create({
    data: {
      businessId,
      name: data.name,
      phone,
      email: data.email ?? null,
      notes: data.notes ?? null,
      // אם לא צוינה רמה: יש טלפון → UNVERIFIED, אחרת NONE ("ללא טלפון").
      verificationStatus: data.verificationStatus ?? (phone ? 'UNVERIFIED' : 'NONE'),
    },
  });
}

/** עדכון פרטי לקוח (מסונן לפי העסק כדי למנוע גישה חוצה עסקים). */
export async function updateClient(
  businessId: string,
  id: string,
  data: ClientInput,
) {
  const phone = data.phone?.trim() ? normalizePhone(data.phone) : null;
  const patch: Prisma.ClientUpdateManyMutationInput = {
    name: data.name,
    phone,
    email: data.email ?? null,
    notes: data.notes ?? null,
  };
  // רמת אימות מתעדכנת רק כאשר נמסרה במפורש (בעל העסק בחר לסמן/לתקן).
  if (data.verificationStatus) patch.verificationStatus = data.verificationStatus;
  const result = await prisma.client.updateMany({
    where: { id, businessId },
    data: patch,
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

/**
 * קביעת רמת אימות הזהות של לקוח ידנית על ידי בעל העסק (סימון "מאומת"/"טופל").
 * מסונן לפי העסק כדי למנוע גישה חוצה עסקים.
 */
export async function setClientVerification(
  businessId: string,
  id: string,
  verificationStatus: VerificationLevel,
) {
  const result = await prisma.client.updateMany({
    where: { id, businessId },
    data: { verificationStatus },
  });
  return result.count > 0;
}
