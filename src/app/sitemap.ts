import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getListedBusinessSlugs } from '@/server/repos/business';

/**
 * מפת אתר דינמית: עמוד הבית, עמודי שיווק/משפט ציבוריים, עמוד ספריית העסקים
 * /businesses ועמודי העסקים המוצגים /b/[slug].
 *
 * force-dynamic (ולא revalidate): הבאג בפרודקשן היה שהמפה נבנתה בזמן build ללא DB,
 * הוגשה ריקה מעמודי עסק, וה-revalidate לא מילא אותה בפועל. רינדור דינמי בזמן בקשה
 * מבטיח שהמפה תמיד משקפת את מצב ה-DB העדכני. השאילתה עטופה ב-try/catch כך שכשל DB
 * מחזיר לפחות את העמודים הסטטיים במקום להפיל את המסלול.
 *
 * getListedBusinessSlugs מחזיר עסקים מוצגים בלבד (listed=true), כך שעסקים מוסתרים
 * אינם נכנסים למפה — אותו דגל מאוחד ששולט ברשימה ובאינדוקס.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    // עמוד ספריית העסקים הציבורי.
    {
      url: `${SITE_URL}/businesses`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    // עמודי שיווק/משפט ציבוריים הניתנים לסריקה.
    ...['/legal', '/roadmap', '/quote', '/migrate'].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];

  let businessEntries: MetadataRoute.Sitemap = [];
  try {
    const businesses = await getListedBusinessSlugs();
    businessEntries = businesses.map((b) => ({
      url: `${SITE_URL}/b/${b.slug}`,
      lastModified: b.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch {
    // אם מסד הנתונים אינו זמין בזמן הבנייה, מחזירים לפחות את העמודים הסטטיים.
    businessEntries = [];
  }

  return [...staticEntries, ...businessEntries];
}
