// מודול תוכן דמו לקליניקת "סקין ביוטי קליניק" (יבנה).
// טהור לחלוטין: ללא Prisma, ללא React. נצרך גם ע"י ה-seed (בניית העסק)
// וגם ע"י בדיקות היחידה. נתיבי התמונות מצביעים ל-public/images/clinic ולוגו ב-public/brand.

import type { LandingContent } from '@/lib/publicPageStyle';

/** בסיס הנתיב לנכסי הקליניקה שהועתקו ל-public (העתקה בלבד מאתר ההשראה). */
const IMG = '/images/clinic';

/** זהות העסק — משמשת את ה-seed לעמודות Business וגם לקישורים החברתיים ב-landingContent. */
export const CLINIC_IDENTITY = {
  slug: 'skin-beauty',
  name: 'סקין ביוטי קליניק',
  tagline: 'הסטנדרד החדש של עולם האסתטיקה',
  description:
    'סקין ביוטי קליניק יבנה – קליניקת אסתטיקה רפואית מתקדמת. בוטוקס, מילוי שפתיים, פיסול אף, RF, לייזר להסרת שיער, PRP לשיער ואבחון עור. בדיקת התאמה מקצועית והתאמה אישית למבנה הפנים, העור והמטרה שלך – ליד הבית.',
  phone: '054-675-5521',
  whatsapp: '972546755521',
  address: 'הקישון 5, יבנה',
  city: 'יבנה',
  instagramUrl: 'https://www.instagram.com/skin_b_clinic/',
  facebookUrl: 'https://www.facebook.com/profile.php?id=61587016828234',
  brandColor: '#b0855f',
  logoUrl: '/brand/business/skin-beauty.jpg',
  coverImageUrl: `${IMG}/banners/hero.jpg`,
  timezone: 'Asia/Jerusalem',
} as const;

/** טיפול דמו בודד. priceAgorot=0 עם hidePrice=true עבור ייעוץ. */
export interface ClinicService {
  name: string;
  description: string;
  priceAgorot: number;
  durationMin: number;
  hidePrice?: boolean;
  /** נתיב תמונת הטיפול — נשמר ב-landingContent (ל-Service אין עמודת תמונה). */
  image: string;
}

/** עשרת טיפולי הקליניקה. משכי הזמן נבחרו בטווח 30–60 דק' לפי אופי הטיפול. */
export const CLINIC_SERVICES: ClinicService[] = [
  {
    name: 'בוטוקס',
    description:
      'החלקת קמטי הבעה במצח, בין הגבות וסביב העיניים – תוצאה טבעית. מבצע השקה: 3 אזורים ב-₪900.',
    priceAgorot: 90000,
    durationMin: 30,
    image: `${IMG}/treatments/botox.jpg`,
  },
  {
    name: 'פיסול אף ללא ניתוח',
    description:
      'עיצוב קו האף ויישור גבשושיות בעזרת חומצה היאלורונית – ללא ניתוח. מבצע השקה: ₪1600.',
    priceAgorot: 160000,
    durationMin: 45,
    image: `${IMG}/treatments/nose.jpg`,
  },
  {
    name: 'מילוי שפתיים',
    description:
      'מילוי והגדלת שפתיים בחומצה היאלורונית – נפח, לחות וקו שפה מוגדר בתוצאה טבעית.',
    priceAgorot: 120000,
    durationMin: 45,
    image: `${IMG}/gallery/work-lips-1.jpg`,
  },
  {
    name: 'עיצוב קו לסת וסנטר',
    description:
      'חידוד קו הלסת והבלטת הסנטר בהזרקה – פרופיל מוגדר וחד למראה הפנים.',
    priceAgorot: 140000,
    durationMin: 45,
    image: `${IMG}/gallery/work-jawline.jpg`,
  },
  {
    name: 'RF מתקדם',
    description:
      'מתיחת עור והדבקת קולגן באנרגיית רדיו-תדר – עור הדוק וזוהר. מבצע השקה: ₪450.',
    priceAgorot: 45000,
    durationMin: 30,
    image: `${IMG}/treatments/rf.jpg`,
  },
  {
    name: 'הסרת שיער בלייזר',
    description:
      'הסרת שיער קבועה בלייזר לכל אזורי הגוף – עור חלק לאורך זמן. מבצע השקה: 4 אזורים ב-₪400.',
    priceAgorot: 40000,
    durationMin: 30,
    image: `${IMG}/treatments/laser.jpg`,
  },
  {
    name: 'PRP לשיער ולקרקפת',
    description:
      'פלזמה מהדם שלך לחיזוק שורשי השיער ועידוד צמיחה טבעית. מבצע: 5 טיפולים ב-₪4,250.',
    priceAgorot: 85000,
    durationMin: 45,
    image: `${IMG}/treatments/prp.jpg`,
  },
  {
    name: 'טיפול פנים Glow',
    description:
      'טיפול פנים מעמיק להזנה, ניקוי והקרנת זוהר – עור רענן וקורן.',
    priceAgorot: 35000,
    durationMin: 60,
    image: `${IMG}/treatments/glow-facial.jpg`,
  },
  {
    name: 'אבחון עור מתקדם',
    description:
      'סריקת עור מקצועית לפני כל טיפול – זיהוי הצרכים ובניית תוכנית מדויקת.',
    priceAgorot: 15000,
    durationMin: 30,
    image: `${IMG}/treatments/ai-diagnosis.jpg`,
  },
  {
    name: 'ייעוץ והתאמה אישית',
    description:
      'פגישת ייעוץ אישית להבנת המטרות שלך והתאמת הטיפול המדויק – ללא התחייבות.',
    priceAgorot: 0,
    durationMin: 30,
    hidePrice: true,
    image: `${IMG}/banners/hero.jpg`,
  },
];

/**
 * בונה את תוכן עמוד הנחיתה של הקליניקה. טהור — מחזיר אובייקט LandingContent
 * שתואם בדיוק לסכימה (כל שדה שורד את normalizeLandingContent). מכבד את המכסות:
 * 3 יתרונות, 4 תמונות גלריה, 3 לפני/אחרי, 6 תמונות לקובייה, 2 תמונות הירו.
 */
export function buildClinicLandingContent(): LandingContent {
  return {
    heroEyebrow: 'סקין ביוטי קליניק · יבנה',
    heroHeadline: 'הסטנדרד החדש של עולם האסתטיקה',
    heroSubtext:
      'קליניקת אסתטיקה רפואית מתקדמת ביבנה – בוטוקס, מילויים, לייזר, RF, PRP ואבחון עור. בדיקת התאמה מקצועית והתאמה אישית למבנה הפנים, העור והמטרה שלך.',
    // הירו מפוצל: תמונה ראשית + פנים הקליניקה (עד 2 לפי המכסה)
    heroImages: [`${IMG}/banners/hero.jpg`, `${IMG}/banners/interior.jpg`],
    // שלושת היתרונות המובילים (המכסה היא 3, ולכן "מחירי השקה" מיוצג בפס המבצע)
    benefits: [
      { title: 'צוות רפואי מקצועי', text: 'רופאים ואנשי אסתטיקה מוסמכים עם ניסיון קליני מוכח.' },
      { title: 'בדיקת התאמה אישית', text: 'אבחון עור וייעוץ לפני כל טיפול – תוכנית מדויקת עבורך.' },
      { title: 'טכנולוגיות מתקדמות', text: 'מכשור וחומרים מהדור החדש לתוצאות טבעיות ובטוחות.' },
    ],
    // גלריה (עד 4): פנים הקליניקה ועבודות נבחרות
    galleryImageUrls: [
      `${IMG}/banners/interior.jpg`,
      `${IMG}/gallery/work-jawline.jpg`,
      `${IMG}/gallery/work-lips-1.jpg`,
      `${IMG}/treatments/glow-facial.jpg`,
    ],
    // לפני / אחרי (עד 3)
    beforeAfter: [
      { beforeUrl: `${IMG}/gallery/work-lips-2.jpg`, afterUrl: `${IMG}/gallery/work-lips-1.jpg`, label: 'מילוי שפתיים' },
      { beforeUrl: `${IMG}/gallery/work-lips-4.jpg`, afterUrl: `${IMG}/gallery/work-jawline.jpg`, label: 'עיצוב קו לסת' },
      { beforeUrl: `${IMG}/gallery/work-lips-5.jpg`, afterUrl: `${IMG}/gallery/work-lips-3.jpg`, label: 'טיפול פנים' },
    ],
    about:
      'סקין ביוטי קליניק הוקמה כדי להביא ליבנה ולסביבה סטנדרט גבוה של אסתטיקה רפואית – קרוב לבית. הקליניקה משלבת טכנולוגיות מתקדמות, צוות מקצועי ואווירה מפנקת, עם דגש על התאמה אישית ושקיפות מלאה בכל שלב.',
    socialLinks: {
      whatsapp: CLINIC_IDENTITY.whatsapp,
      instagram: CLINIC_IDENTITY.instagramUrl,
      facebook: CLINIC_IDENTITY.facebookUrl,
    },
    // פס מבצע ההשקה — מזין את הספירה-לאחור. מוסתר אוטומטית אם יוסר.
    launchOffer: {
      text: 'מבצעי השקה לרגל פתיחת הקליניקה ביבנה',
      spotsLeft: 7,
      endsAt: '2026-08-31',
    },
    // "מבצעים חמים" — שש תמונות טיפולים לקובייה התלת-ממדית (בלוק inline)
    hotDeals: {
      eyebrow: 'מבצעים חמים',
      title: 'הטיפולים המבוקשים – במחירי השקה',
      text:
        'מבחר הטיפולים הפופולריים בקליניקה, במחירי היכרות לרגל הפתיחה. קבעו בדיקת התאמה וגלו איזה טיפול מתאים בדיוק לכם.',
      ctaLabel: 'לכל הטיפולים',
      images: [
        `${IMG}/treatments/botox.jpg`,
        `${IMG}/treatments/nose.jpg`,
        `${IMG}/treatments/rf.jpg`,
        `${IMG}/treatments/laser.jpg`,
        `${IMG}/treatments/prp.jpg`,
        `${IMG}/treatments/glow-facial.jpg`,
      ],
    },
  };
}
