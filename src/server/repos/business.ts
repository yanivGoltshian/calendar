import type { BusinessType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { normalizePhone } from '@/lib/crypto';
import { addBusinessDays } from '@/lib/businessDays';
import { defaultBusinessHours, setBusinessHours } from './workingHours';
import { ensureOwnerStaffMember } from './staff';
import { seedServicesForBusiness } from './services';
import { shapeBusinessMetrics, type BusinessMetrics } from '@/app/superadmin/logic';

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
  const from = new Date(now.getTime() - 2 * DAY_MS);
  const to = new Date(now.getTime() + 4 * DAY_MS);
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
  ownerName?: string | null;
  priorCalendar?: string | null;
  referralSource?: string | null;
}) {
  // רשת ביטחון לשחזור (אפיק ההרשמה): אם קיים עסק שממתין למחיקה בבעלות אותו מייל,
  // מספר הטלפון תואם ומועד המחיקה טרם עבר — משחזרים את העסק הקיים במקום ליצור כפול.
  // התפר העיקרי לשחזור הוא מסך השחזור באזור הניהול, וזו רשת הביטחון המשלימה.
  const restorable = await findRestorableBusinessForOwner(input.ownerEmail, input.phone ?? null);
  if (restorable) {
    return restoreBusiness(restorable.id);
  }

  const slug = await generateUniqueSlug(input.name);
  // תקופת ניסיון חינם של 30 יום מרגע היצירה (חבילת בסיס, מצב trialing).
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const business = await prisma.business.create({
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

  // זריעת שעות ברירת מחדל לעסק (scope BUSINESS): ראשון–חמישי 09:00–17:00, שישי/שבת סגורים.
  // בלי זריעה זו לעסק חדש אין אף רשומת WorkingHours, ולכן מנוע הזמינות מחזיר אפס משבצות
  // בכל יום — ולינק ההזמנה נשבר בשקט עד שהבעלים מגדיר שעות ידנית ב-/admin/working-hours.
  // עמיד לתקלות: כשל בזריעה לא ישבור את יצירת העסק, אך בתנאים רגילים הרשומות נכתבות.
  try {
    await setBusinessHours(business.id, defaultBusinessHours());
  } catch {
    // זריעת שעות ברירת המחדל נכשלה; יצירת העסק ממשיכה והבעלים יגדיר שעות ידנית.
  }

  // זריעת איש צוות דיפולטי לבעלים: מיד אחרי יצירת העסק אין אף StaffMember, ולכן היומן
  // ב-/admin מוצג ריק עם ההודעה "לא הוגדרו אנשי צוות" והבעלים תקוע בלי דרך לפעול מהמסך.
  // זורעים איש צוות אחד על שם הבעלים (מזוהה במייל, לא בטלפון) כדי שהיומן יעבוד מיד.
  // עמיד לתקלות: כשל בזריעה לא ישבור את יצירת העסק, בדיוק כמו זריעת השעות למעלה.
  try {
    await ensureOwnerStaffMember(business.id, {
      ownerEmail: input.ownerEmail,
      ownerName: input.ownerName,
      businessName: input.name,
    });
  } catch {
    // זריעת איש הצוות הדיפולטי נכשלה; יצירת העסק ממשיכה והבעלים יוסיף צוות ידנית ב-/admin/team.
  }

  // זריעת שירותי התחלה מתבנית סוג העסק: מיד אחרי היצירה אין אף Service, ולכן היומן ב-/admin
  // מוצג ריק עם ההודעה "לא הוגדרו שירותים" והבעלים תקוע בלי דרך ליצור תורים. זורעים שירותים
  // טיפוסיים לפי סוג העסק (או תבנית ברירת מחדל) כדי שהיומן יהיה שמיש מיד; הבעלים עורך/מוחק אחריהם.
  // אידמפוטנטי (רץ רק כשאין שירותים) ועמיד לתקלות: כשל בזריעה לא ישבור את יצירת העסק.
  try {
    await seedServicesForBusiness(business.id, input.type ?? null);
  } catch {
    // זריעת שירותי ההתחלה נכשלה; יצירת העסק ממשיכה והבעלים יוסיף שירותים ידנית ב-/admin/services.
  }

  // שאלות השיווק (אפיק D2) נשמרות בצורה עמידה: אם המיגרציה האדיטיבית טרם הוחלה
  // בסביבה, יצירת העסק לא תישבר; העדכון נכשל בשקט והשדות פשוט לא נכתבים עד שתרוץ.
  if (input.priorCalendar || input.referralSource) {
    try {
      await prisma.business.update({
        where: { id: business.id },
        data: {
          priorCalendar: input.priorCalendar ?? null,
          referralSource: input.referralSource ?? null,
        },
      });
    } catch {
      // עמודות השיווק האדיטיביות עדיין לא קיימות בסביבה; מתעלמים בבטחה.
    }
  }

  return business;
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
export async function restoreBusiness(businessId: string) {
  return prisma.business.update({
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
export async function findRestorableBusinessForOwner(ownerEmail: string, phone: string | null) {
  const pending = await prisma.business.findFirst({
    where: {
      ownerEmail,
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
