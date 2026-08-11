import type { BusinessType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

/** שליפת עסק לפי slug, כולל הגדרות, שירותים גלויים וצוות פעיל. */
export async function getBusinessBySlug(slug: string) {
  return prisma.business.findUnique({
    where: { slug },
    include: {
      settings: true,
      services: {
        where: { hidden: false },
        orderBy: { sortOrder: 'asc' },
      },
      staff: {
        where: { active: true },
        orderBy: { createdAt: 'asc' },
      },
      workingHours: {
        where: { scope: 'BUSINESS' },
        orderBy: { weekday: 'asc' },
      },
    },
  });
}

/** שליפת עסק לפי מזהה. */
export async function getBusinessById(id: string) {
  return prisma.business.findUnique({
    where: { id },
    include: { settings: true },
  });
}

/** שליפת העסק הראשון (נוח לניהול ב-MVP עם עסק יחיד). */
export async function getFirstBusiness() {
  return prisma.business.findFirst({
    include: { settings: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** שליפת כל ה-slugs של העסקים — לשימוש במפת האתר ובבנייה סטטית. */
export async function getAllBusinessSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return prisma.business.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * שליפת שדות המיתוג בלבד של עסק לפי slug — לשימוש במניפסט ובאייקון של ה-PWA.
 * שולף מעט שדות כדי לא להעמיס, ומחזיר null כשהעסק לא קיים.
 */
export async function getBusinessBranding(slug: string) {
  return prisma.business.findUnique({
    where: { slug },
    select: { slug: true, name: true, logoUrl: true, brandColor: true },
  });
}

/**
 * העסק הפעיל לפי הבעלים המאומת (NextAuth).
 * אם קיים session עם מייל -> מחזיר את העסק האחרון שבבעלות אותו מייל (ownerEmail).
 * אחרת -> נופל ל-getFirstBusiness (תאימות לאורחים וללינקים עמוקים, כמו עמוד demo).
 * זהו תפר ה-scoping של אזור הניהול: הבעלות נגזרת מהמייל המאומת (מונע IDOR).
 */
export async function getActiveBusiness() {
  const session = await auth();
  const email = session?.user?.email;
  if (email) {
    const owned = await prisma.business.findFirst({
      where: { ownerEmail: email },
      include: { settings: true },
      orderBy: { createdAt: 'desc' },
    });
    if (owned) return owned;
  }
  return getFirstBusiness();
}

/** כל העסקים שבבעלות מייל נתון, מהחדש לישן. */
export async function getBusinessesOwnedByEmail(email: string) {
  return prisma.business.findMany({
    where: { ownerEmail: email },
    orderBy: { createdAt: 'desc' },
  });
}

/** כל העסקים במערכת, מהחדש לישן — לשימוש בקונסולת ניהול-על בלבד. */
export async function listAllBusinesses() {
  return prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * גזירת slug בטוח-URL משם העסק. שומר לטיניות וספרות, מסיר עברית ותווים אחרים.
 * כשלא נותר בסיס תקין (למשל שם עברי בלבד) — נופל ל-'esek'.
 */
function slugifyName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[\u0590-\u05FF]+/g, '') // הסרת עברית (slug נשאר אסקי קריא)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return base || 'esek';
}

/** מייצר slug ייחודי; מוסיף סיפוקס מספרי בהתנגשות (לא דורס עסקים קיימים). */
async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugifyName(name);
  let candidate = base;
  let n = 1;
  // בדיקת ייחודיות מול העמודה הייחודית slug.
  while (await prisma.business.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

/**
 * יצירת עסק חדש בבעלות מייל מאומת (אפיק D1).
 * מייצר slug ייחודי, אזור זמן ברירת מחדל, ורשומת הגדרות ריקה נלווית.
 */
export async function createBusiness(input: {
  name: string;
  type?: BusinessType | null;
  phone?: string | null;
  address?: string | null;
  ownerEmail: string;
}) {
  const slug = await generateUniqueSlug(input.name);
  // תקופת ניסיון חינם של 14 יום מרגע היצירה (חבילת בסיס, מצב trialing).
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return prisma.business.create({
    data: {
      name: input.name,
      type: input.type ?? undefined,
      phone: input.phone ?? null,
      address: input.address ?? null,
      slug,
      timezone: process.env.BUSINESS_TIMEZONE || 'Asia/Jerusalem',
      ownerEmail: input.ownerEmail,
      plan: 'basic',
      subscriptionStatus: 'trialing',
      trialEndsAt,
      settings: { create: {} },
    },
    include: { settings: true },
  });
}
