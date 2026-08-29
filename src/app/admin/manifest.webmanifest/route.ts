import { BRAND } from '@/config/brand';
import { getBusinessBranding } from '@/server/repos/business';
import { resolveBrandColor, resolveBackgroundColor } from '@/lib/brandColor';

/**
 * מניפסט PWA לאזור ניהול העסק (/admin) — מותאם-הקשר.
 * scope ו-id נפרדים מהמניפסט הגלובלי (/) ומהמניפסט לכל עסק (/b/[slug]),
 * כך שאפשר להתקין את סביבת הניהול כאפליקציה עצמאית משלה.
 *
 * הדפדפן מושך את המניפסט ללא עוגיות ולכן אינו יכול לזהות את העסק מהסשן; לפיכך
 * layout האדמין מעביר את מזהה העסק בכתובת (?slug=...), בדיוק כמו עמוד ההזמנות.
 * כשיש slug של עסק קיים — מוחזר מניפסט ממותג-עסק (שם העסק, צבעיו ואייקוני הלוגו
 * שלו דרך /b/[slug]/icon), שנפתח אל /admin. ללא slug או כשהעסק לא נמצא — נפילה
 * בטוחה למניפסט המותג הגנרי של הפלטפורמה. כתובת נפרדת לכל slug, ולכן המטמון תקין.
 */
export const runtime = 'nodejs';

const HEADERS = {
  'Content-Type': 'application/manifest+json; charset=utf-8',
  'Cache-Control': 'public, max-age=0, must-revalidate',
};

/**
 * מניפסט המותג הגנרי של הפלטפורמה — נפילה בטוחה כשאין עסק בהקשר
 * (אין slug בכתובת או שהעסק לא נמצא). זהה למניפסט הסטטי שקדם למיתוג-ההקשר.
 */
function platformManifest() {
  return {
    id: '/admin',
    name: `${BRAND.name} · ניהול העסק`,
    short_name: 'ניהול',
    description: `ניהול התורים, הלקוחות והעסק ב${BRAND.name} — ישירות ממסך הבית.`,
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    background_color: BRAND.backgroundColor,
    theme_color: BRAND.themeColor,
    dir: 'rtl',
    lang: 'he',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-admin-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-admin-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-admin-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug');

  if (slug) {
    const business = await getBusinessBranding(slug);
    if (business) {
      // מיחזור route האייקון הקיים של העסק (שמפיק את הלוגו עם נפילה חיננית לאות
      // ראשונה) — אותו מקור אייקונים שבו משתמש מניפסט עמוד ההזמנות.
      const base = `/b/${business.slug}`;
      const manifest = {
        id: '/admin',
        name: business.name,
        short_name: business.name.slice(0, 12),
        description: `ניהול התורים, הלקוחות והעסק של ${business.name} — ישירות ממסך הבית.`,
        start_url: '/admin',
        scope: '/admin',
        display: 'standalone',
        background_color: resolveBackgroundColor(),
        theme_color: resolveBrandColor(business.brandColor),
        dir: 'rtl',
        lang: 'he',
        orientation: 'portrait',
        icons: [
          {
            src: `${base}/icon?size=192`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}/icon?size=512`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: `${base}/icon?size=512&maskable=1`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      };

      return new Response(JSON.stringify(manifest), { headers: HEADERS });
    }
  }

  return new Response(JSON.stringify(platformManifest()), { headers: HEADERS });
}
