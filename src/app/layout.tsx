import type { Metadata, Viewport } from 'next';
import { BRAND } from '@/config/brand';
import { fontVariables } from '@/config/fonts';
import { JsonLd } from '@/components/JsonLd';
import {
  SITE_URL,
  SITE_DESCRIPTION,
  organizationJsonLd,
  webSiteJsonLd,
  ogImageUrl,
} from '@/lib/seo';
import ServiceWorkerRegistrar from './ServiceWorkerRegistrar';
import './globals.css';

// כל הדפים מוגשים דינמית (SSR) — הרינדור ניגש למסד בזמן ריצה, לכן אין prerender ב-build.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — זימון תורים וניהול עסק`,
    template: `%s · ${BRAND.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: BRAND.name,
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    url: SITE_URL,
    siteName: BRAND.name,
    title: `${BRAND.name} — זימון תורים וניהול עסק`,
    description: SITE_DESCRIPTION,
    images: [{ url: ogImageUrl(), width: 1200, height: 630, alt: BRAND.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — זימון תורים וניהול עסק`,
    description: SITE_DESCRIPTION,
    images: [ogImageUrl()],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={fontVariables} suppressHydrationWarning>
      <body>
        {children}
        <ServiceWorkerRegistrar />
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
      </body>
    </html>
  );
}
