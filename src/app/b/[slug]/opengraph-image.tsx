import { ImageResponse } from 'next/og';
import { getBusinessBranding } from '@/server/repos/business';
import { loadHebrewFont, loadImage, loadLogo } from '@/lib/og/assets';
import { buildBusinessOgModel } from '@/lib/og/model';

/**
 * כרטיס שיתוף (Open Graph) דינמי לכל עסק — 1200x630, נחיתה (landscape).
 * מתקן את הבאג שבו שיתוף לינק עסק ב-WhatsApp/רשתות הראה את לוגו הפלטפורמה:
 * כאן מרונדרת תמונת העסק (coverImageUrl) במילוי מלא כשקיימת, אחרת הלוגו של
 * העסק, ואחרת אות ראשונה על רקע צבע המותג — ותמיד שם העסק מעל.
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

  // טעינת תמונת העסק והלוגו לפני בניית המודל: כשתמונת העסק נטענת בהצלחה
  // המודל בוחר mode='cover'; אחרת נופל ללוגו, ואם גם הוא חסר — לאות ראשונה
  // על רקע צבע המותג. כל טעינה שנכשלת מחזירה null ומורידה מדרגה בבטחה.
  const cover = await loadImage(business?.coverImageUrl ?? null);
  const logo = await loadLogo(business?.logoUrl ?? null);
  const model = buildBusinessOgModel({
    name: business?.name ?? null,
    coverUrl: cover,
    logoUrl: logo,
    brandColor: business?.brandColor ?? null,
  });
  const name = business?.name ?? '';

  const bold = await loadHebrewFont(700);
  const fonts = bold
    ? [{ name: 'Assistant', data: bold, weight: 700 as const, style: 'normal' as const }]
    : [];

  const element =
    model.mode === 'cover' ? (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'Assistant, sans-serif',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover ?? ''}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1200px',
            height: '630px',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '1200px',
            height: '360px',
            display: 'flex',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.10) 60%, rgba(0,0,0,0))',
          }}
        />
        {logo ? (
          <div
            style={{
              position: 'absolute',
              top: '48px',
              right: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '132px',
              height: '132px',
              background: '#ffffff',
              borderRadius: '28px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.30)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo}
              alt=""
              width={104}
              height={104}
              style={{ width: '104px', height: '104px', objectFit: 'contain' }}
            />
          </div>
        ) : null}
        {name ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '1200px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: '64px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                maxWidth: '1000px',
                color: '#ffffff',
                fontSize: '72px',
                fontWeight: 700,
                lineHeight: 1.1,
                textAlign: 'right',
                textShadow: '0 3px 18px rgba(0,0,0,0.55)',
              }}
            >
              {name}
            </div>
          </div>
        ) : null}
      </div>
    ) : (
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
    );

  return new ImageResponse(element, {
    ...size,
    ...(fonts.length ? { fonts } : {}),
  });
}
