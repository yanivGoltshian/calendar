import type { MetadataRoute } from 'next';
import { BRAND } from '@/config/brand';

/**
 * מניפסט ה-PWA — נוצר דינמית כדי לקרוא את שם המותג ממקור אמת יחיד (BRAND).
 * מוגש בכתובת /manifest.webmanifest לפי מוסכמת Next.js.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline || `${BRAND.name} — מערכת לקביעת תורים וניהול עסק`,
    start_url: '/',
    display: 'standalone',
    background_color: BRAND.backgroundColor,
    theme_color: BRAND.themeColor,
    dir: 'rtl',
    lang: 'he',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
