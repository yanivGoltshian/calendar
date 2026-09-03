import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getAllBusinessSlugs } from '@/server/repos/business';

/**
 * מפת אתר דינמית: עמוד הבית, עמודי שיווק/משפט ציבוריים ועמודי העסקים /b/[slug].
 * העוזר getAllBusinessSlugs מאפשר הרחבה אוטומטית ככל שנוספים עסקים.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
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
    const businesses = await getAllBusinessSlugs();
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
