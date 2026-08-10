import type { Metadata, Viewport } from 'next';
import { BRAND } from '@/config/brand';
import ServiceWorkerRegistrar from './ServiceWorkerRegistrar';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.tagline || `${BRAND.name} — מערכת לקביעת תורים וניהול עסק`,
  manifest: '/manifest.webmanifest',
  applicationName: BRAND.name,
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
