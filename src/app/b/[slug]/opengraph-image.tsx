import { ImageResponse } from 'next/og';
import { getBusinessBranding } from '@/server/repos/business';
import { loadHebrewFont, loadLogo } from '@/lib/og/assets';
import { buildBusinessOgModel } from '@/lib/og/model';

/**
 * כרטיס שיתוף (Open Graph) דינמי לכל עסק — 1200x630, נחיתה (landscape).
 * מתקן את הבאג שבו שיתוף לינק עסק ב-WhatsApp/רשתות הראה את לוגו הפלטפורמה:
 * כאן מרונדרים הלוגו של העסק (או אות ראשונה על רקע צבע המותג) ושם העסק.
 *
 * זהו קובץ file-convention של Next: כשעמוד העסק אינו קובע openGraph.images
 * במפורש, Next מזריק אוטומטית את התגית המצביעה לתמונה זו (וגם ל-Twitter).
 * שומרים על תמונה קלה ונשענים על מטמון Next כדי ש-WhatsApp/פייסבוק
 * (שמוותרים על תמונת OG כבדה/איטית) יציגו אותה.
 */
export const runtime = 'nodejs';

export const alt = 'כרטיס שיתוף העסק';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ slug: string }> };

export default async function BusinessOpengraphImage({ params }: Props) {
  const { slug } = await params;
  const business = await getBusinessBranding(slug);

  // טעינת הלוגו לפני בניית המודל: אם הטעינה נכשלה (או אין לוגו/עסק),
  // המודל נופל אוטומטית לאות ראשונה על רקע צבע המותג — ללא קריסה.
  const logo = await loadLogo(business?.logoUrl ?? null);
  const model = buildBusinessOgModel({
    name: business?.name ?? null,
    logoUrl: logo,
    brandColor: business?.brandColor ?? null,
  });
  const name = business?.name ?? '';

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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: model.background,
          fontFamily: 'Assistant, sans-serif',
          padding: '80px',
        }}
      >
        {model.mode === 'logo' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '320px',
              height: '320px',
              background: '#ffffff',
              borderRadius: '56px',
              boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo ?? ''}
              alt=""
              width={256}
              height={256}
              style={{ width: '256px', height: '256px', objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '320px',
              height: '320px',
              color: model.fg,
              fontSize: '200px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {model.initial}
          </div>
        )}

        {name ? (
          <div
            style={{
              display: 'flex',
              marginTop: '52px',
              maxWidth: '1000px',
              color: model.fg,
              fontSize: '68px',
              fontWeight: 700,
              lineHeight: 1.1,
              textAlign: 'center',
            }}
          >
            {name}
          </div>
        ) : null}
      </div>
    ),
    {
      ...size,
      ...(fonts.length ? { fonts } : {}),
    },
  );
}
