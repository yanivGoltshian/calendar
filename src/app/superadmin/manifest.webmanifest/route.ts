import { BRAND } from '@/config/brand';

/**
 * מניפסט PWA ייעודי לקונסולת הפלטפורמה (/superadmin).
 * scope ו-id נפרדים משאר המניפסטים, כך שמנהל הפלטפורמה יכול להתקין
 * את קונסולת הניהול-על כאפליקציה עצמאית משלה, עם שם ואייקון ייחודיים.
 */
export const runtime = 'nodejs';

export function GET() {
  const manifest = {
    id: '/superadmin',
    name: `${BRAND.name} · פלטפורמה`,
    short_name: 'פלטפורמה',
    description: `קונסולת ניהול-על של ${BRAND.name} — ניהול העסקים והמנויים בפלטפורמה.`,
    start_url: '/superadmin',
    scope: '/superadmin',
    display: 'standalone',
    background_color: BRAND.backgroundColor,
    theme_color: BRAND.themeColor,
    dir: 'rtl',
    lang: 'he',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-superadmin-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-superadmin-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-superadmin-512.png',
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
