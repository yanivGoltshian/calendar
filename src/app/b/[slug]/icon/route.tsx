import { ImageResponse } from 'next/og';
import { getBusinessBranding } from '@/server/repos/business';
import { resolveBrandColor, readableText } from '@/lib/brandColor';

/**
 * אייקון PWA דינמי לכל עסק (PNG מרובע).
 * מפיק את האייקון מהלוגו שהעסק העלה; כשאין לוגו (או שהטעינה נכשלה)
 * נופל לאות הראשונה של שם העסק על רקע צבע המותג.
 * מקבל ?size= (ברירת מחדל 512) ו-?maskable=1 לריפוד בטוח למסכות.
 */
export const runtime = 'nodejs';

type Props = { params: Promise<{ slug: string }> };

const OLD_UA =
  'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.85 Safari/537.36';

/** טוען גופן עברי (TTF) מ-Google Fonts; מחזיר null בכשל. */
async function loadHebrewFont(weight: 700): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Assistant:wght@${weight}`;
    const css = await fetch(cssUrl, { headers: { 'User-Agent': OLD_UA } }).then((r) => r.text());
    const match = css.match(/src:\s*url\(([^)]+\.ttf)\)/);
    if (!match) return null;
    return await fetch(match[1]).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

/** מנסה לטעון לוגו חיצוני כ-data URI; מחזיר null בכשל. */
async function loadLogo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/png';
    if (!type.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString('base64');
    return `data:${type};base64,${base64}`;
  } catch {
    return null;
  }
}

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
