import { ImageResponse } from 'next/og';
import { getBusinessBranding } from '@/server/repos/business';
import { loadHebrewFont, loadImage, loadLogo } from '@/lib/og/assets';
import { buildBusinessOgModel } from '@/lib/og/model';
import { toVisualOrder } from '@/lib/og/bidi';

/**
 * כרטיס שיתוף (Open Graph) דינמי לכל עסק — תמיד 1200x630 נחיתה (landscape),
 * מרונדר דרך ImageResponse ומוגש כ-PNG כדי שהמטא-דאטה המוצהרת
 * (og:image:type=image/png, width=1200, height=630, וכן twitter:image)
 * תהיה זהה למה שמוגש בפועל — כך WhatsApp/פייסבוק/טוויטר מציגים כרטיס תקין.
 *
 * הרכב הכרטיס: רקע קרם (#faf6ef) עם פסי מותג, בצד אחד קופסת לוגו לבנה
 * (או אות ראשונה על רקע צבע המותג כשאין לוגו), ובצד השני שם העסק, תיאור
 * קצר שנגזר מהתיאור המלא, וגלולת קריאה לפעולה. כשאין לוגו אך יש תמונת עסק
 * (coverImageUrl) נופלים לכרטיס מלא-תמונה. כל טקסט עברי מומר לסדר ויזואלי
 * (toVisualOrder) לפני הרינדור, כי Satori לא מבצע bidi ומתעלם מ-direction:rtl.
 *
 * זהו קובץ file-convention של Next: כשעמוד העסק אינו קובע openGraph.images
 * במפורש, Next מזריק אוטומטית את התגית המצביעה לתמונה זו (וגם ל-Twitter).
 */
export const runtime = 'nodejs';

export const alt = 'כרטיס שיתוף העסק';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ slug: string }> };

/**
 * גוזר תיאור קצר (tagline) לכרטיס השיתוף מתוך תיאור העסק: לוקח את הטקסט
 * שאחרי המקף הראשון (אם קיים) ואז את המשפט הראשון. נופל ל-typeLabel כשאין
 * תיאור מתאים או כשהתוצאה ארוכה מדי (מעל 52 תווים) כדי לא לשבור את הפריסה.
 */
function deriveOgTagline(description: string | null, typeLabel: string): string {
  const raw = (description ?? '').trim();
  if (raw) {
    const dash = raw.search(/[–—-]/);
    let t = dash >= 0 ? raw.slice(dash + 1) : raw;
    t = t.split(/[.!?\n]/)[0].trim();
    if (t.length >= 2 && t.length <= 52) return t;
  }
  return typeLabel;
}

export default async function BusinessOpengraphImage({ params }: Props) {
  const { slug } = await params;
  const business = await getBusinessBranding(slug);

  // טעינת הלוגו ותמונת העסק לפני בניית המודל: כשהלוגו נטען בהצלחה המודל
  // בוחר mode='logo'; אחרת נופל לתמונת העסק (cover), ואם גם היא חסרה — לאות
  // ראשונה על רקע צבע המותג. כל טעינה שנכשלת מחזירה null ומורידה מדרגה בבטחה.
  const cover = await loadImage(business?.coverImageUrl ?? null);
  const logo = await loadLogo(business?.logoUrl ?? null);
  const model = buildBusinessOgModel({
    name: business?.name ?? null,
    coverUrl: cover,
    logoUrl: logo,
    brandColor: business?.brandColor ?? null,
    type: business?.type ?? null,
    services: business?.services?.map((s) => s.name) ?? null,
  });

  // המרה לסדר ויזואלי — לרינדור בלבד (Satori לא מבצע bidi). פעם אחת לכל מחרוזת.
  const vName = model.name ? toVisualOrder(model.name) : '';
  const vType = model.typeLabel ? toVisualOrder(model.typeLabel) : '';
  const vCta = toVisualOrder(model.cta);
  const tagline = deriveOgTagline(business?.description ?? null, model.typeLabel ?? '');
  const vTagline = tagline ? toVisualOrder(tagline) : '';

  const bold = await loadHebrewFont(700);
  const fonts = bold
    ? [{ name: 'Assistant', data: bold, weight: 700 as const, style: 'normal' as const }]
    : [];

  // גלולת קריאה לפעולה בצבע המותג — קושרת את הכרטיס למותג ומדגישה שהליבה
  // היא הזמנת תור. fg מבטיח ניגודיות קריאה מעל צבע המותג.
  const ctaPill = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: model.background,
        color: model.fg,
        fontSize: '30px',
        fontWeight: 700,
        padding: '14px 30px',
        borderRadius: '999px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
      }}
    >
      {vCta}
    </div>
  );

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
            height: '430px',
            display: 'flex',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.86), rgba(0,0,0,0.16) 62%, rgba(0,0,0,0))',
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
            padding: '60px',
            boxSizing: 'border-box',
          }}
        >
          {vType ? (
            <div
              style={{
                display: 'flex',
                color: 'rgba(255,255,255,0.92)',
                fontSize: '34px',
                fontWeight: 700,
                marginBottom: '10px',
                textShadow: '0 2px 12px rgba(0,0,0,0.55)',
              }}
            >
              {vType}
            </div>
          ) : null}
          {vName ? (
            <div
              style={{
                display: 'flex',
                maxWidth: '1040px',
                color: '#ffffff',
                fontSize: '74px',
                fontWeight: 700,
                lineHeight: 1.08,
                textAlign: 'right',
                textShadow: '0 3px 18px rgba(0,0,0,0.55)',
              }}
            >
              {vName}
            </div>
          ) : null}
          <div style={{ display: 'flex', marginTop: '24px' }}>{ctaPill}</div>
        </div>
      </div>
    ) : (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#faf6ef',
          fontFamily: 'Assistant, sans-serif',
          padding: '72px 84px',
          boxSizing: 'border-box',
        }}
      >
        {/* פסי מבטא מותג למעלה ולמטה — קושרים את הכרטיס למותג העסק. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1200px',
            height: '10px',
            display: 'flex',
            background: model.background,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '1200px',
            height: '16px',
            display: 'flex',
            background: model.background,
          }}
        />

        {/* צד שמאל: קופסת לוגו לבנה, או אות ראשונה על רקע צבע המותג. */}
        {model.mode === 'logo' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '340px',
              height: '340px',
              background: '#ffffff',
              borderRadius: '48px',
              border: '1px solid #ece3d6',
              boxShadow: '0 30px 60px -30px rgba(40,28,18,0.5)',
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo ?? ''}
              alt=""
              width={244}
              height={244}
              style={{ width: '244px', height: '244px', objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '340px',
              height: '340px',
              background: model.background,
              borderRadius: '48px',
              boxShadow: '0 30px 60px -30px rgba(40,28,18,0.5)',
              color: model.fg,
              fontSize: '190px',
              fontWeight: 700,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {model.initial}
          </div>
        )}

        {/* צד ימין: שם העסק, תיאור קצר, וגלולת קריאה לפעולה. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            textAlign: 'right',
            maxWidth: '660px',
          }}
        >
          {vName ? (
            <div
              style={{
                display: 'flex',
                color: '#2a211c',
                fontSize: '72px',
                fontWeight: 700,
                lineHeight: 1.08,
                textAlign: 'right',
              }}
            >
              {vName}
            </div>
          ) : null}

          {vTagline ? (
            <div
              style={{
                display: 'flex',
                marginTop: '22px',
                color: model.background,
                fontSize: '36px',
                fontWeight: 700,
                lineHeight: 1.2,
                textAlign: 'right',
              }}
            >
              {vTagline}
            </div>
          ) : null}

          <div style={{ display: 'flex', marginTop: '36px' }}>{ctaPill}</div>
        </div>
      </div>
    );

  return new ImageResponse(element, {
    ...size,
    ...(fonts.length ? { fonts } : {}),
  });
}
