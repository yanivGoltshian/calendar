import type { Metadata, Viewport } from 'next';
import { getBusinessBranding } from '@/server/repos/business';
import { resolveBrandColor } from '@/lib/brandColor';

/**
 * פריסת סגמנט העסק — מזריקה מטא-דאטה של PWA ממותג-עסק:
 * קישור למניפסט הדינמי של העסק, apple-touch-icon מהאייקון הדינמי,
 * וצבע theme לפי צבע המותג. אדיטיבי בלבד; לא משנה את תוכן העמוד.
 */

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const base = `/b/${slug}`;
  const business = await getBusinessBranding(slug);

  return {
    manifest: `${base}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: business?.name,
      statusBarStyle: 'default',
    },
    icons: {
      icon: `${base}/icon?size=192`,
      apple: `${base}/icon?size=192`,
    },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const business = await getBusinessBranding(slug);
  return {
    themeColor: resolveBrandColor(business?.brandColor),
  };
}

export default function BusinessSegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
