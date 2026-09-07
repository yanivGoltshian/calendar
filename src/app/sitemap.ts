import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getListedBusinesses } from '@/server/repos/publicDirectory';

/**
 * מפת אתר דינמית: עמוד הבית, עמודי שיווק/משפט ציבוריים ועמודי העסקים /b/[slug].
 * נכללים רק עסקים שעומדים בתנאי הפרסום והחשיפה.
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
    // עמודי שיווק/משפט ציבוריים הניתנים לסריקה.
    ...['/legal', '/roadmap', '/businesses', '/migrate'].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];

  const businesses = await getListedBusinesses();
  const businessEntries: MetadataRoute.Sitemap = businesses.map((b) => ({
      url: `${SITE_URL}/b/${b.slug}`,
      lastModified: b.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.8,
  }));

  return [...staticEntries, ...businessEntries];
}
