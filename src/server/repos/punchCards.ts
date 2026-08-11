import { prisma } from '@/lib/db';
import type { PunchCardStatus } from '@prisma/client';

/**
 * מודול כרטיסיות ניקוב (PunchCard).
 * לוגיקה מעל השדות schema-בלבד שהורחבו: יצירה, ניקוב (הגדלת usedPunches + השלמה אוטומטית),
 * מימוש ידני וביטול. כל שאילתה מסוננת לפי businessId למניעת גישה חוצת־עסקים.
 */

/** רשימת כרטיסיות בעסק (אופציונלית לפי סטטוס), עם לקוח ושירות. */
export function listPunchCards(businessId: string, status?: PunchCardStatus) {
  return prisma.punchCard.findMany({
    where: { businessId, ...(status ? { status } : {}) },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    include: {
      client: { select: { id: true, name: true, phone: true } },
      service: { select: { id: true, name: true } },
    },
  });
}

export type CreatePunchCardInput = {
  clientId: string;
  serviceId?: string | null;
  title?: string | null;
  totalPunches: number;
  priceAgorot?: number | null;
  note?: string | null;
  expiresAt?: Date | null;
};

/** יצירת כרטיסייה חדשה. מאמת שהלקוח (והשירות אם ניתן) שייכים לעסק. */
export async function createPunchCard(
  businessId: string,
  data: CreatePunchCardInput,
): Promise<{ ok: true; id: string } | { ok: false; reason: 'client_not_found' }> {
  const client = await prisma.client.findFirst({
    where: { id: data.clientId, businessId },
    select: { id: true },
  });
  if (!client) return { ok: false, reason: 'client_not_found' };

  let serviceId: string | null = null;
  if (data.serviceId) {
    const service = await prisma.service.findFirst({
      where: { id: data.serviceId, businessId },
      select: { id: true },
    });
    serviceId = service?.id ?? null;
  }

  const created = await prisma.punchCard.create({
    data: {
      businessId,
      clientId: client.id,
      serviceId,
      title: data.title ?? null,
      totalPunches: data.totalPunches,
      priceAgorot: data.priceAgorot ?? null,
      note: data.note ?? null,
      expiresAt: data.expiresAt ?? null,
    },
    select: { id: true },
  });
  return { ok: true, id: created.id };
}

/**
 * ניקוב כרטיסייה: מגדיל usedPunches ומעדכן lastPunchAt.
 * כאשר מגיעים למכסה — הכרטיסייה עוברת אוטומטית ל-COMPLETED עם completedAt.
 * פועל רק על כרטיסייה פעילה שטרם נוצלה במלואה.
 */
export async function punchPunchCard(
  businessId: string,
  id: string,
): Promise<
  | { ok: true; completed: boolean }
  | { ok: false; reason: 'not_found' | 'not_active' | 'full' }
> {
  const card = await prisma.punchCard.findFirst({ where: { id, businessId } });
  if (!card) return { ok: false, reason: 'not_found' };
  if (card.status !== 'ACTIVE') return { ok: false, reason: 'not_active' };
  if (card.usedPunches >= card.totalPunches) return { ok: false, reason: 'full' };

  const usedPunches = card.usedPunches + 1;
  const completed = usedPunches >= card.totalPunches;
  const now = new Date();

  await prisma.punchCard.update({
    where: { id: card.id },
    data: {
      usedPunches,
      lastPunchAt: now,
      ...(completed ? { status: 'COMPLETED', completedAt: now } : {}),
    },
  });
  return { ok: true, completed };
}

/** מימוש/סגירה ידנית של כרטיסייה (COMPLETED). */
export async function completePunchCard(
  businessId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.punchCard.updateMany({
    where: { id, businessId, status: 'ACTIVE' },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });
  return result.count > 0;
}

/** ביטול כרטיסייה (CANCELLED). */
export async function cancelPunchCard(
  businessId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.punchCard.updateMany({
    where: { id, businessId, status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  });
  return result.count > 0;
}
