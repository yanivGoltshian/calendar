import { prisma } from '@/lib/db';

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
