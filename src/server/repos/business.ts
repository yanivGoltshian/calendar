import type { BusinessType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { defaultBusinessHours, setBusinessHours } from './workingHours';
import { ensureOwnerStaffMember } from './staff';
import { seedServicesForBusiness } from './services';

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
  ownerName?: string | null;
  priorCalendar?: string | null;
  referralSource?: string | null;
}) {
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
