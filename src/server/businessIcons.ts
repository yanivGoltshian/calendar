import { createHash } from 'node:crypto';

type Branding = {
  slug: string;
  name: string;
  logoUrl?: string | null;
  brandColor?: string | null;
};

export function businessIconUrl(business: Branding, size: 192 | 512 = 192, maskable = false): string {
  const version = createHash('sha256')
    .update(JSON.stringify([business.name, business.logoUrl ?? null, business.brandColor ?? null]))
    .digest('hex').slice(0, 16);
  return `/b/${encodeURIComponent(business.slug)}/icon?size=${size}&v=${version}${maskable ? '&maskable=1' : ''}`;
}
