import { ImageResponse } from 'next/og';
import { getBusinessBranding } from '@/server/repos/business';
import { resolveBrandColor, readableText } from '@/lib/brandColor';
import { loadHebrewFont, loadLogo } from '@/lib/og/assets';

/**
 * אייקון PWA דינמי לכל עסק (PNG מרובע).
 * מפיק את האייקון מהלוגו שהעסק העלה; כשאין לוגו (או שהטעינה נכשלה)
 * נופל לאות הראשונה של שם העסק על רקע צבע המותג.
 * מקבל ?size= (ברירת מחדל 512) ו-?maskable=1 לריפוד בטוח למסכות.
 */
export const runtime = 'nodejs';

type Props = { params: Promise<{ slug: string }> };

function clampSize(raw: string | null): number {
  const n = Number(raw);
  if (n === 192) return 192;
  return 512;
}

export async function GET(req: Request, { params }: Props) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const size = clampSize(searchParams.get('size'));
  const maskable = searchParams.get('maskable') === '1';

  const business = await getBusinessBranding(slug);
  const brand = resolveBrandColor(business?.brandColor);
  const fg = readableText(brand);
  const name = business?.name ?? '';

  const logo = await loadLogo(business?.logoUrl ?? null);
  // בריפוד למסכה שומרים כ-66% מהבד; אחרת כ-82%.
  const contentRatio = maskable ? 0.66 : 0.82;
  const contentPx = Math.round(size * contentRatio);

  const bold = await loadHebrewFont(700);
  const fonts = bold
    ? [{ name: 'Assistant', data: bold, weight: 700 as const, style: 'normal' as const }]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: brand,
          fontFamily: 'Assistant, sans-serif',
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            width={contentPx}
            height={contentPx}
            style={{
              width: `${contentPx}px`,
              height: `${contentPx}px`,
              objectFit: 'contain',
              borderRadius: `${Math.round(contentPx * 0.18)}px`,
            }}
          />
        ) : (
          <div
            style={{
              color: fg,
              fontSize: `${Math.round(size * 0.5)}px`,
              fontWeight: 700,
              lineHeight: 1,
              display: 'flex',
            }}
          >
            {name.charAt(0) || '\u2022'}
          </div>
        )}
      </div>
    ),
    {
      width: size,
      height: size,
      ...(fonts.length ? { fonts } : {}),
    },
  );
}
