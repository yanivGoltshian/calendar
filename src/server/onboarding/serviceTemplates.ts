import type { BusinessType } from '@prisma/client';

/**
 * תבניות שירות התחלתיות לפי סוג עסק (אונבורדינג).
 * מטרה: מיד עם יצירת העסק היומן מקבל שירותים טיפוסיים ולכן שמיש ללא הגדרה ידנית.
 * המחירים כאן הם ערכי פתיחה סבירים בלבד (באגורות) והבעלים עורך/מוחק/מוסיף אחריהם.
 * מודול טהור ללא DB — הזריעה עצמה נעשית ב-seedServicesForBusiness (services repo).
 */
export type ServiceTemplateItem = {
  /** שם השירות בעברית (RTL נקי, ללא מקפים קישוטיים). */
  name: string;
  /** משך בדקות. */
  durationMin: number;
  /** מחיר פתיחה באגורות (ניתן לעריכה). 0 = ייעוץ/היכרות ללא תשלום. */
  priceAgorot: number;
};

/**
 * תבנית ברירת מחדל לכל סוג ללא תבנית ייעודית (כולל OTHER וערך חסר).
 * שירותים כלליים שאפשר לשנות מיד לשמות האמיתיים של העסק.
 */
export const DEFAULT_SERVICE_TEMPLATE: ServiceTemplateItem[] = [
  { name: 'פגישת ייעוץ', durationMin: 30, priceAgorot: 0 },
  { name: 'שירות בסיסי', durationMin: 45, priceAgorot: 10000 },
  { name: 'שירות מורחב', durationMin: 60, priceAgorot: 15000 },
];

/** תבניות ייעודיות לכל סוג עסק. סוג ללא רשומה כאן נופל לתבנית ברירת המחדל. */
const TEMPLATES_BY_TYPE: Partial<Record<BusinessType, ServiceTemplateItem[]>> = {
  BARBERSHOP: [
    { name: 'תספורת גברים', durationMin: 30, priceAgorot: 6000 },
    { name: 'תספורת וזקן', durationMin: 45, priceAgorot: 8000 },
    { name: 'עיצוב זקן', durationMin: 20, priceAgorot: 4000 },
    { name: 'תספורת ילדים', durationMin: 30, priceAgorot: 5000 },
  ],
  HAIR_SALON: [
    { name: 'תספורת נשים', durationMin: 45, priceAgorot: 12000 },
    { name: 'פן', durationMin: 45, priceAgorot: 9000 },
    { name: 'צבע שיער', durationMin: 90, priceAgorot: 25000 },
    { name: 'גוונים', durationMin: 120, priceAgorot: 40000 },
  ],
  NAILS: [
    { name: 'לק ג׳ל', durationMin: 45, priceAgorot: 9000 },
    { name: 'מניקור', durationMin: 40, priceAgorot: 7000 },
    { name: 'פדיקור', durationMin: 50, priceAgorot: 10000 },
    { name: 'בנייה בג׳ל', durationMin: 90, priceAgorot: 18000 },
  ],
  BEAUTY_COSMETICS: [
    { name: 'טיפול פנים', durationMin: 60, priceAgorot: 20000 },
    { name: 'ניקוי עור עמוק', durationMin: 60, priceAgorot: 18000 },
    { name: 'הסרת שיער בשעווה', durationMin: 30, priceAgorot: 6000 },
    { name: 'עיצוב גבות', durationMin: 20, priceAgorot: 4000 },
  ],
  SPA_MASSAGE: [
    { name: 'עיסוי שוודי', durationMin: 60, priceAgorot: 25000 },
    { name: 'עיסוי רקמות עמוק', durationMin: 60, priceAgorot: 28000 },
    { name: 'עיסוי זוגי', durationMin: 60, priceAgorot: 45000 },
    { name: 'טיפול ספא משולב', durationMin: 90, priceAgorot: 35000 },
  ],
  BROWS_LASHES: [
    { name: 'עיצוב גבות', durationMin: 30, priceAgorot: 6000 },
    { name: 'שיפוץ ריסים', durationMin: 90, priceAgorot: 22000 },
    { name: 'הרמת ריסים', durationMin: 60, priceAgorot: 18000 },
    { name: 'למינציית גבות', durationMin: 45, priceAgorot: 15000 },
  ],
  TATTOO_PIERCING: [
    { name: 'פגישת ייעוץ', durationMin: 30, priceAgorot: 0 },
    { name: 'קעקוע קטן', durationMin: 60, priceAgorot: 30000 },
    { name: 'פירסינג אוזן', durationMin: 20, priceAgorot: 12000 },
    { name: 'פירסינג גוף', durationMin: 30, priceAgorot: 18000 },
  ],
  CLINIC: [
    { name: 'ייעוץ ראשוני', durationMin: 45, priceAgorot: 30000 },
    { name: 'טיפול מעקב', durationMin: 30, priceAgorot: 20000 },
    { name: 'בדיקה תקופתית', durationMin: 30, priceAgorot: 25000 },
  ],
  FITNESS: [
    { name: 'אימון אישי', durationMin: 60, priceAgorot: 18000 },
    { name: 'אימון זוגי', durationMin: 60, priceAgorot: 25000 },
    { name: 'אימון היכרות', durationMin: 45, priceAgorot: 0 },
    { name: 'בניית תוכנית אימונים', durationMin: 30, priceAgorot: 15000 },
  ],
};

/**
 * החזרת תבנית השירותים לסוג עסק נתון.
 * סוג ללא תבנית ייעודית (כולל OTHER, null או undefined) מקבל את תבנית ברירת המחדל.
 * תמיד מחזיר מערך לא ריק, ולכן העסק שמיש מיד עם היצירה.
 */
export function getServiceTemplate(
  type: BusinessType | null | undefined,
): ServiceTemplateItem[] {
  if (!type) return DEFAULT_SERVICE_TEMPLATE;
  return TEMPLATES_BY_TYPE[type] ?? DEFAULT_SERVICE_TEMPLATE;
}
