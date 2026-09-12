import { Prisma, type BusinessType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { normalizeEmail, normalizePhone } from '@/lib/crypto';
import { addBusinessDays } from '@/lib/businessDays';
import { defaultBusinessHours } from './workingHours';
import { resolveOwnerDisplayName } from './staff';
import { getServiceTemplate } from '@/server/onboarding/serviceTemplates';
import { computeTrialHashes, resolveTrialDecision } from './trialLedger';
import { shapeBusinessMetrics, type BusinessMetrics } from '@/app/superadmin/logic';
import { getImpersonatedBusinessId } from '@/server/impersonation';
import { getBusinessAccess } from '@/server/subscription';
import { businessOwnerWhere } from '@/lib/businessOwnerIdentity';

/**
 * שליפת עסק לפי slug, כולל הגדרות, שירותים גלויים וצוות פעיל.
 * מסנן עסקים שממתינים למחיקה (accountStatus=PENDING_DELETION): העמוד הציבורי,
 * עמוד ההזמנות וה-API של הזמינות "עיוורים" לעסק חסום, ולכן מחזיר null (→notFound)
 * מיד עם בקשת המחיקה ועד לשחזור או למחיקה הסופית. זהו תפר החסימה הציבורי היחיד.
 */
export async function getBusinessBySlug(slug: string) {
  return prisma.business.findFirst({
    where: { slug, accountStatus: { not: 'PENDING_DELETION' } },
    include: {
      settings: true,
      owner: { select: { email: true } },
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

/**
 * שליפת עסקים המועמדים למייל התראת סוף-ניסיון (cron יומי).
 *
 * מחזיר עסקים בחבילת ניסיון בסיסית (plan='basic') ופעילים (accountStatus='ACTIVE')
 * שמועד סוף הניסיון שלהם נופל בחלון רחב סביב "עכשיו" — מיומיים אחורה ועד ארבעה
 * ימים קדימה — המכסה בשוליים בטוחים גם את שכבת האזהרה (~3 ימים לפני) וגם את שכבת
 * הפקיעה (סביב היום עצמו). הסיווג המדויק לשכבה נעשה ב-classifyTrialNotice, ולכן
 * החלון כאן מכוון להיות מכיל ולא מדויק. השדות המצומצמים מספיקים לבניית המייל.
 */
export async function getBusinessesForTrialExpiryNotice(now: Date) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  // חלון רחב דיו לכל חמש השכבות: warn7 (+7 ימים) עד postExpired (-3 ימים), עם מרווח סבילות.
  const from = new Date(now.getTime() - 4 * DAY_MS);
  const to = new Date(now.getTime() + 8 * DAY_MS);
  return prisma.business.findMany({
    where: {
      plan: 'basic',
      accountStatus: 'ACTIVE',
      trialEndsAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      name: true,
      ownerEmail: true,
      trialEndsAt: true,
      owner: { select: { email: true, name: true } },
    },
  });
}

/** שליפת העסק הראשון (נוח לניהול ב-MVP עם עסק יחיד). */
export async function getFirstBusiness() {
  return prisma.business.findFirst({
    include: { settings: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * שני עסקי הדגמה לבוחר ה-/demo:
 * - premium: עסק ה-plan==='premium' הראשון (הקליניקה skin-beauty).
 * - standard: עסק ה-plan!=='premium' הראשון (המספרה).
 * נופל חזרה לעסק הראשון כשאין התאמה, כדי לא לשבור אורחים ולינקים עמוקים.
 */
export async function getExampleBusinesses() {
  const [premium, standard] = await Promise.all([
    prisma.business.findFirst({
      where: { plan: 'premium' },
      orderBy: { createdAt: 'asc' },
      select: { slug: true, name: true },
    }),
    prisma.business.findFirst({
      where: { NOT: { plan: 'premium' } },
      orderBy: { createdAt: 'asc' },
      select: { slug: true, name: true },
    }),
  ]);
  const fallback =
    standard ?? premium
      ? null
      : await prisma.business.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { slug: true, name: true },
        });
  return {
    standard: standard ?? fallback,
    premium: premium ?? null,
  };
}

/** שליפת כל ה-slugs של העסקים — לשימוש במפת האתר ובבנייה סטטית. */
export async function getAllBusinessSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  return prisma.business.findMany({
    // עסק שממתין למחיקה מוסתר גם ממפת האתר (sitemap) כמו מהעמוד הציבורי עצמו.
    where: { accountStatus: { not: 'PENDING_DELETION' } },
    select: { slug: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * שליפת שדות המיתוג בלבד של עסק לפי slug — לשימוש במניפסט, באייקון של ה-PWA
 * ובכרטיס השיתוף (OG). כולל coverImageUrl (תמונת העסק) שכרטיס השיתוף מעדיף
 * על הלוגו. שולף מעט שדות כדי לא להעמיס, ומחזיר null כשהעסק לא קיים.
 */
export async function getBusinessBranding(slug: string) {
  return prisma.business.findFirst({
    where: { slug, accountStatus: { not: 'PENDING_DELETION' } },
    select: {
      slug: true,
      name: true,
      description: true,
      logoUrl: true,
      brandColor: true,
      coverImageUrl: true,
      type: true,
      address: true,
      services: {
        where: { hidden: false },
        orderBy: { sortOrder: 'asc' },
        take: 3,
        select: { name: true },
      },
    },
  });
}

/**
 * Authorization boundary for tenant operations. Demo/public lookups never grant authority.
 * Only authenticated ownership or verified, explicit platform-admin impersonation selects
 * a tenant. Inactive access is reserved for recovery/billing, never ordinary mutations.
 */
export async function getActiveBusiness(options: { allowInactive?: boolean } = {}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const impersonatedId = await getImpersonatedBusinessId();
  const business = impersonatedId
    ? await getBusinessById(impersonatedId)
    : await prisma.business.findFirst({
        where: businessOwnerWhere(email),
        include: { settings: true },
        orderBy: { createdAt: 'desc' },
      });
  if (!business) return null;
  if (!options.allowInactive &&
      (business.accountStatus !== 'ACTIVE' || !getBusinessAccess(business).active)) {
    return null;
  }
  return business;
}

/** כל העסקים שבבעלות מייל נתון, מהחדש לישן. */
export async function getBusinessesOwnedByEmail(email: string) {
  return prisma.business.findMany({
    where: businessOwnerWhere(email),
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
 * מטריקות תפעוליות לרשימת עסקים — אגרגציה יעילה ב-groupBy יחיד לכל מדד (ללא N+1).
 * מחזיר מפה לפי מזהה עסק: לקוחות, תורים, שווי תורים (לא-מבוטלים) ותקבולים בקופה.
 * לשימוש בקונסולת ניהול-על בלבד.
 */
export async function getBusinessMetricsMap(
  businessIds: string[],
): Promise<Map<string, BusinessMetrics>> {
  if (businessIds.length === 0) return new Map();
  const where = { businessId: { in: businessIds } };
  const [clientRows, appointmentCountRows, appointmentValueRows, saleRows] = await Promise.all([
    prisma.client.groupBy({ by: ['businessId'], where, _count: { _all: true } }),
    prisma.appointment.groupBy({ by: ['businessId'], where, _count: { _all: true } }),
    prisma.appointment.groupBy({
      by: ['businessId'],
      where: { ...where, status: { not: 'CANCELLED' } },
      _sum: { totalPriceAgorot: true },
    }),
    prisma.sale.groupBy({ by: ['businessId'], where, _sum: { paidAgorot: true } }),
  ]);
  return shapeBusinessMetrics({
    clientCounts: clientRows.map((row) => ({ businessId: row.businessId, count: row._count._all })),
    appointmentCounts: appointmentCountRows.map((row) => ({
      businessId: row.businessId,
      count: row._count._all,
    })),
    appointmentValues: appointmentValueRows.map((row) => ({
      businessId: row.businessId,
      sumAgorot: row._sum.totalPriceAgorot ?? 0,
    })),
    cashReceipts: saleRows.map((row) => ({
      businessId: row.businessId,
      sumAgorot: row._sum.paidAgorot ?? 0,
    })),
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
async function generateUniqueSlug(name: string, db: Prisma.TransactionClient): Promise<string> {
  const base = slugifyName(name);
  let candidate = base;
  let n = 1;
  // בדיקת ייחודיות מול העמודה הייחודית slug.
  while (await db.business.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

// Includes inactive and deletion-pending accounts until they are purged.
export const MAX_BUSINESSES_PER_OWNER = 3;

export class BusinessCreationLimitError extends Error {
  readonly code = 'business_limit';
  constructor() {
    super(`An owner may have at most ${MAX_BUSINESSES_PER_OWNER} businesses.`);
  }
}

export class BusinessIdentityConflictError extends Error {
  constructor() {
    super('An existing business already uses one of these owner identities.');
  }
}

/** Create a fully bookable trial tenant, or roll back every seed and ledger write. */
export async function createBusiness(input: {
  name: string;
  type?: BusinessType | null;
  phone?: string | null;
  address?: string | null;
  ownerEmail: string;
  ownerName?: string | null;
  ownerGoogleSub?: string | null;
  priorCalendar?: string | null;
  referralSource?: string | null;
  provisioning?: { adminEmail: string; phoneIdentity: string | null };
}) {
  const ownerEmail = normalizeEmail(input.ownerEmail);
  if (!ownerEmail) throw new Error('An authenticated owner email is required.');
  const hashes = computeTrialHashes(ownerEmail, input.phone ?? null, input.ownerGoogleSub);
  const ownerIdentities = [...new Set([ownerEmail, input.provisioning?.phoneIdentity].filter(
    (identity): identity is string => Boolean(identity),
  ))];
  const fingerprintOr = [
    { emailHash: hashes.emailHash },
    ...(hashes.phoneHash ? [{ phoneHash: hashes.phoneHash }] : []),
    ...(hashes.googleSubHash ? [{ googleSubHash: hashes.googleSubHash }] : []),
  ];
  const lockKeys = [
    ...ownerIdentities.map((identity) => `business-owner:${computeTrialHashes(identity, null).emailHash}`),
    `business-slug:${slugifyName(input.name)}`,
    ...Object.values(hashes).filter((hash): hash is string => Boolean(hash)).map((hash) => `trial:${hash}`),
  ].sort();

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        for (const key of lockKeys) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
        }
        const existingOwners = await tx.business.findMany({
          where: { OR: ownerIdentities.map(businessOwnerWhere) },
          include: { settings: true, staff: true, services: true },
        });
        if (input.provisioning && existingOwners.length > 0) {
          const existing = existingOwners[0];
          if (existingOwners.length === 1 && existing.provisionedBy &&
              normalizeEmail(existing.ownerEmail ?? '') === ownerEmail &&
              existing.ownerPhoneIdentity === input.provisioning.phoneIdentity) return existing;
          throw new BusinessIdentityConflictError();
        }
        // A stale self-registration form must not duplicate a pre-created account.
        const provisioned = existingOwners.find((business) => business.provisionedBy);
        if (provisioned) return provisioned;
        const restorable = await findRestorableBusinessForOwner(ownerEmail, input.phone ?? null, tx);
        if (restorable) return restoreBusiness(restorable.id, tx);
        const count = await tx.business.count({
          where: { ownerEmail: { equals: ownerEmail, mode: 'insensitive' } },
        });
        if (count >= MAX_BUSINESSES_PER_OWNER) throw new BusinessCreationLimitError();

        const now = new Date();
        const existingTrial = await tx.trialLedger.findFirst({
          where: { OR: fingerprintOr }, orderBy: { originalTrialEndsAt: 'asc' },
        });
        const decision = resolveTrialDecision(existingTrial?.originalTrialEndsAt ?? null, now);
        if (existingTrial) {
          await tx.trialLedger.update({
            where: { id: existingTrial.id }, data: { registrationCount: { increment: 1 } },
          });
        } else {
          await tx.trialLedger.create({
            data: { ...hashes, originalTrialEndsAt: decision.trialEndsAt, firstTrialStartedAt: now },
          });
        }
        const owner = await tx.user.upsert({
          where: { email: ownerEmail }, update: {}, create: { email: ownerEmail, role: 'OWNER' },
        });
        const business = await tx.business.create({
          data: {
            name: input.name, type: input.type ?? undefined, phone: input.phone ?? null,
            address: input.address ?? null, slug: await generateUniqueSlug(input.name, tx),
            timezone: process.env.BUSINESS_TIMEZONE || 'Asia/Jerusalem', ownerEmail,
            ownerPhoneIdentity: input.provisioning?.phoneIdentity,
            provisionedBy: input.provisioning?.adminEmail,
            plan: 'basic', subscriptionStatus: decision.subscriptionStatus,
            trialEndsAt: decision.trialEndsAt,
            priorCalendar: input.priorCalendar ?? null, referralSource: input.referralSource ?? null,
            settings: { create: {} },
            workingHours: { create: defaultBusinessHours().map((row) => ({ ...row, scope: 'BUSINESS' })) },
            staff: { create: {
              userId: owner.id, permissionLevel: 'MANAGER', active: true,
              displayName: resolveOwnerDisplayName({
                ownerName: input.ownerName, ownerUserName: owner.name,
                businessName: input.name, ownerEmail,
              }),
            } },
            services: { create: getServiceTemplate(input.type).map((service, sortOrder) => ({
              name: service.name, durationMin: service.durationMin,
              priceAgorot: service.priceAgorot, sortOrder,
            })) },
          },
          include: { settings: true, staff: true, services: true },
        });
        await tx.serviceStaff.createMany({
          data: business.services.map((service) => ({ serviceId: service.id, staffId: business.staff[0].id })),
        });
        return business;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 20000 });
    } catch (error) {
      if (
        attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) continue;
      throw error;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// מחיקת מנוי, שחזור ומחיקה סופית (purge)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * בקשת מחיקת מנוי: מסמן את העסק כ-PENDING_DELETION, שומר את מועד הבקשה ואת מועד
 * המחיקה הסופית (14 ימי עסקים קדימה, מדלג על שישי ושבת). ההשבתה מיידית: מרגע זה
 * העמוד הציבורי מוסתר ואזור הניהול מוחלף במסך שחזור, עד שחזור או מחיקה סופית.
 */
export async function requestBusinessDeletion(businessId: string) {
  const now = new Date();
  const purgeScheduledFor = addBusinessDays(now, 14);
  return prisma.business.update({
    where: { id: businessId },
    data: {
      accountStatus: 'PENDING_DELETION',
      deletionRequestedAt: now,
      purgeScheduledFor,
    },
  });
}

/**
 * שחזור מנוי: מחזיר עסק שהיה PENDING_DELETION למצב ACTIVE ומנקה את מועדי המחיקה.
 * כל נתוני העסק נשמרים במלואם עד למחיקה הסופית, ולכן שחזור מחזיר הכול לקדמותו.
 */
export async function restoreBusiness(businessId: string, db: Prisma.TransactionClient = prisma) {
  return db.business.update({
    where: { id: businessId },
    data: {
      accountStatus: 'ACTIVE',
      deletionRequestedAt: null,
      purgeScheduledFor: null,
    },
    include: { settings: true },
  });
}

/**
 * איתור עסק בר-שחזור לבעלים: עסק בבעלות אותו מייל שנמצא ב-PENDING_DELETION ומועד
 * המחיקה שלו טרם עבר. אימות הטלפון: אם לעסק נשמר טלפון, הטלפון שהוזן חייב להיות
 * תואם (מנורמל ל-E.164). אם לא נשמר טלפון (חשבון ישן), הזהות מבוססת-המייל המאומת
 * מספיקה לשחזור, שכן המייל כבר עבר אימות בהתחברות. מחזיר null כשאין התאמה.
 */
export async function findRestorableBusinessForOwner(
  ownerEmail: string, phone: string | null, db: Prisma.TransactionClient = prisma,
) {
  const pending = await db.business.findFirst({
    where: {
      ownerEmail: { equals: ownerEmail.trim(), mode: 'insensitive' },
      accountStatus: 'PENDING_DELETION',
      OR: [{ purgeScheduledFor: null }, { purgeScheduledFor: { gt: new Date() } }],
    },
    orderBy: { deletionRequestedAt: 'desc' },
  });
  if (!pending) return null;
  if (pending.phone) {
    if (!phone) return null;
    let enteredNormalized: string;
    let storedNormalized: string;
    try {
      enteredNormalized = normalizePhone(phone);
      storedNormalized = normalizePhone(pending.phone);
    } catch {
      return null;
    }
    if (enteredNormalized !== storedNormalized) return null;
  }
  return pending;
}

/**
 * מחיקה סופית של עסקים שהגיע מועד המחיקה שלהם (purge). מוחק קשיח בטרנזקציה לכל עסק:
 * קודם התורים (מסירים AppointmentService שמוגן ב-Restrict), ואז העסק עצמו —
 * וה-cascade מוחק את כל נתוני הלקוחות והעסק (לקוחות, תורים, שירותים, צוות, מכירות,
 * מסמכים, תזכורות ועוד). רשומת המשתמש-בעלים (מזוהה-מייל) מנוקה רק אם אינה בבעלות
 * עסק אחר. עמיד לתקלות: כשל בניקוי הבעלים לא יפגע במחיקת נתוני העסק שכבר בוצעה.
 */
export async function purgeExpiredBusinesses(
  now: Date = new Date(),
): Promise<{ purgedBusinessIds: string[] }> {
  const due = await prisma.business.findMany({
    where: {
      accountStatus: 'PENDING_DELETION',
      purgeScheduledFor: { lte: now },
    },
    select: { id: true, ownerEmail: true },
  });
  const purgedBusinessIds: string[] = [];
  for (const b of due) {
    await prisma.$transaction([
      prisma.appointment.deleteMany({ where: { businessId: b.id } }),
      prisma.business.delete({ where: { id: b.id } }),
    ]);
    purgedBusinessIds.push(b.id);
    if (b.ownerEmail) {
      try {
        const otherOwned = await prisma.business.count({ where: { ownerEmail: b.ownerEmail } });
        if (otherOwned === 0) {
          await prisma.user.deleteMany({ where: { email: b.ownerEmail } });
        }
      } catch {
        // ניקוי רשומת הבעלים נכשל; נתוני העסק כבר נמחקו. מתעלמים בבטחה.
      }
    }
  }
  return { purgedBusinessIds };
}
