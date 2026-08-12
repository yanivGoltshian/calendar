import { BRAND } from '@/config/brand';

/**
 * מניפסט PWA ייעודי לאזור ניהול העסק (/admin).
 * scope ו-id נפרדים מהמניפסט הגלובלי (/) ומהמניפסט לכל עסק (/b/[slug]),
 * כך שבעל העסק יכול להתקין את סביבת הניהול כאפליקציה עצמאית משלה,
 * עם שם ואייקון ייחודיים, במקביל לאפליקציות ה-PWA הקיימות.
 */
export const runtime = 'nodejs';

export function GET() {
  const manifest = {
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

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
