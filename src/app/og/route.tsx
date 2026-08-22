import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BRAND } from '@/config/brand';
import { SITE_DESCRIPTION } from '@/lib/seo';
import { toVisualOrder } from '@/lib/og/bidi';

/**
 * תמונת Open Graph דינמית (1200x630) בעברית עם רקע מותג (נייבי + זהב).
 * מקבלת ?title= ו-?subtitle=. טעינת הפונט העברי והאמבלם עטופה ב-try/catch
 * כדי שכשל לא ישבור את הרינדור.
 */
export const runtime = 'nodejs';

const SIZE = { width: 1200, height: 630 };

const OLD_UA =
  'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.85 Safari/537.36';

/** מנסה לטעון את אמבלם המותג כ-data URI; מחזיר null בכשל. */
async function loadEmblem(): Promise<string | null> {
  try {
    const buf = await readFile(
      join(process.cwd(), 'public', 'brand', 'torchick-emblem-navy-256.png'),
    );
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** מנסה לטעון גופן עברי (TTF) מ-Google Fonts; מחזיר null בכשל. */
async function loadHebrewFont(weight: 400 | 700): Promise<ArrayBuffer | null> {
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawTitle = searchParams.get('title');
  const hasTitle = rawTitle != null && rawTitle.trim().length > 0;

  const emblem = await loadEmblem();

  // מצב לוגו — שיתוף כללי של הפלטפורמה (ללא ?title=). מרנדר את אמבלם המותג
  // שכבר כולל את שם המותג בעברית כפיקסלים, ולכן אין טקסט חי של Satori ואין
  // סיכון להיפוך אותיות בכיווניות RTL.
  if (!hasTitle) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            background: 'linear-gradient(135deg, #06101f 0%, #16233a 55%, #24406e 100%)',
          }}
        >
          {emblem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={emblem}
              alt=""
              width={460}
              height={460}
              style={{
                width: '460px',
                height: '460px',
                borderRadius: '64px',
                border: '1px solid rgba(206,162,74,0.35)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
              }}
            />
          ) : (
            <div
              style={{
                width: '460px',
                height: '460px',
                borderRadius: '64px',
                background: 'rgba(206,162,74,0.12)',
                border: '2px solid rgba(206,162,74,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '240px',
                  height: '240px',
                  borderRadius: '9999px',
                  border: '10px solid #cea24a',
                }}
              />
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '8px',
              background: 'linear-gradient(90deg, #9a7635 0%, #cea24a 50%, #f2d695 100%)',
            }}
          />
        </div>
      ),
      { ...SIZE },
    );
  }

  // מצב כותרת — כרטיסי עמודים עם ?title= (למשל עמודי עסק). נשמר כפי שהיה,
  // כולל טעינת הגופן העברי לרינדור הכותרת והתת-כותרת.
  const title = rawTitle;
  const subtitle = searchParams.get('subtitle') ?? SITE_DESCRIPTION;

  const [regular, bold] = await Promise.all([loadHebrewFont(400), loadHebrewFont(700)]);

  const fonts = [
    ...(regular
      ? [{ name: 'Assistant', data: regular, weight: 400 as const, style: 'normal' as const }]
      : []),
    ...(bold
      ? [{ name: 'Assistant', data: bold, weight: 700 as const, style: 'normal' as const }]
      : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          direction: 'rtl',
          padding: '80px',
          background: 'linear-gradient(135deg, #06101f 0%, #16233a 55%, #24406e 100%)',
          fontFamily: 'Assistant, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {emblem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={emblem}
              alt=""
              width={72}
              height={72}
              style={{ width: '72px', height: '72px', borderRadius: '20px' }}
            />
          ) : (
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '20px',
                background: 'rgba(206,162,74,0.20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#cea24a',
                fontSize: '44px',
                fontWeight: 700,
              }}
            >
              {BRAND.name.charAt(0)}
            </div>
          )}
          <div style={{ color: '#ffffff', fontSize: '40px', fontWeight: 700 }}>{BRAND.name}</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '24px',
          }}
        >
          <div
            style={{
              color: '#ffffff',
              fontSize: '68px',
              fontWeight: 700,
              lineHeight: 1.15,
              textAlign: 'right',
              maxWidth: '1000px',
            }}
          >
            {toVisualOrder(title)}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '34px',
              fontWeight: 400,
              lineHeight: 1.4,
              textAlign: 'right',
              maxWidth: '980px',
            }}
          >
            {toVisualOrder(subtitle)}
          </div>
        </div>

        <div
          style={{
            width: '100%',
            height: '8px',
            borderRadius: '9999px',
            background: 'linear-gradient(90deg, #9a7635 0%, #cea24a 50%, #f2d695 100%)',
          }}
        />
      </div>
    ),
    {
      ...SIZE,
      ...(fonts.length ? { fonts } : {}),
    },
  );
}
