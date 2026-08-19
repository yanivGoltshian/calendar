import { PrismaClient } from '@prisma/client';

/**
 * מופע יחיד (singleton) של Prisma Client.
 * מונע יצירת חיבורים כפולים ב-hot-reload בסביבת פיתוח.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * חוסן חיבור מול Azure Postgres מ-Azure Container Apps: מוסיף connect_timeout ו-
 * pool_timeout ל-DATABASE_URL רק אם אינם קיימים כבר, כדי שחיבור "קר" לא ייתקע
 * ללא גבול (מה שגורם ל-P2024/P1001 אחרי ~30 שניות). מוסיף פרמטרים בלבד ובאופן
 * לא הרסני — לעולם לא נוגע ב-user:pass@host ולא דורס sslmode/pgbouncer/טיים-אאוט
 * שכבר הוגדרו, כך שאפשר לעקוף דרך משתנה הסביבה. תומך רק בסכימת postgres(ql).
 */
function withConnectionResilience(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl;
  if (!/^postgres(ql)?:\/\//i.test(rawUrl)) return rawUrl;
  const need: string[] = [];
  if (!/[?&]connect_timeout=/.test(rawUrl)) need.push('connect_timeout=15');
  if (!/[?&]pool_timeout=/.test(rawUrl)) need.push('pool_timeout=15');
  if (need.length === 0) return rawUrl;
  const sep = rawUrl.includes('?') ? '&' : '?';
  return rawUrl + sep + need.join('&');
}

const datasourceUrl = withConnectionResilience(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // datasourceUrl דורס את env("DATABASE_URL") מהסכימה עם גרסה מוקשחת של אותה
    // כתובת. מדלגים כשאין DATABASE_URL כדי לא לשבור build/בדיקות ולתת ל-Prisma
    // ליפול חזרה לברירת המחדל של הסכימה.
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
