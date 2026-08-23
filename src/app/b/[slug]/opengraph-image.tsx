import { ImageResponse } from 'next/og';
import { getBusinessBranding } from '@/server/repos/business';
import { loadHebrewFont, loadImage, loadLogo } from '@/lib/og/assets';
import { buildBusinessOgModel } from '@/lib/og/model';
import { toVisualOrder } from '@/lib/og/bidi';
import { absoluteUrl } from '@/lib/seo';

/**
 * כרטיס שיתוף (Open Graph) דינמי לכל עסק — 1200x630, נחיתה (landscape).
 * מתקן את הבאג שבו שיתוף לינק עסק ב-WhatsApp/רשתות הראה את לוגו הפלטפורמה:
 * כשלעסק יש לוגו — משתפים את קובץ הלוגו עצמו בלבד (בייטים גולמיים, ללא
 * כרטיס מורכב, ללא שם/סוג/שירותים/קריאה לפעולה), כדי ש-WhatsApp/פייסבוק
 * יראו את הלוגו הנקי. רק כשאין לוגו נופלים לכרטיס מרונדר: תמונת העסק
 * (coverImageUrl) במילוי מלא, ואחרת אות ראשונה על רקע צבע המותג. בכרטיס
 * הזה כל טקסט עברי מומר לסדר ויזואלי (toVisualOrder) לפני הרינדור, כי
 * Satori לא מבצע bidi ומתעלם מ-direction:rtl.
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

  // כשלעסק יש לוגו — מגישים את קובץ הלוגו עצמו כתגובת התמונה ומדלגים לגמרי
  // על Satori/ImageResponse, כדי שהשיתוף יהיה הלוגו הנקי בלבד (ללא כרטיס,
  // ללא שם/סוג/שירותים/קריאה לפעולה). לוגו גובר על cover בראוט הזה. נפילה
  // בטוחה: אם ה-fetch נכשל ממשיכים להתנהגות הקיימת (cover, ואחרת אות ראשונה).
  if (business?.logoUrl) {
    try {
      const abs = business.logoUrl.startsWith('/')
        ? absoluteUrl(business.logoUrl)
        : business.logoUrl;
      const res = await fetch(abs);
      const ct = res.headers.get('content-type') ?? '';
      if (res.ok && ct.startsWith('image/')) {
        const buf = await res.arrayBuffer();
        return new Response(buf, {
          headers: {
            'Content-Type': ct || 'image/jpeg',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
          },
        });
      }
    } catch {
      // נמשיך למסלול הכרטיס המרונדר למטה
    }
  }

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
  const vServices = model.services.map((s) => toVisualOrder(s));

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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: model.background,
          fontFamily: 'Assistant, sans-serif',
          padding: '72px',
          boxSizing: 'border-box',
        }}
      >
        {/* שכבת ברק עדינה כדי שהרקע לא ייראה שטוח; מרונדרת לפני התוכן. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1200px',
            height: '630px',
            display: 'flex',
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(0,0,0,0.22))',
          }}
        />
        {model.mode === 'logo' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '300px',
              height: '300px',
              background: '#ffffff',
              borderRadius: '56px',
              boxShadow: '0 24px 70px rgba(0,0,0,0.28)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logo ?? ''}
              alt=""
              width={236}
              height={236}
              style={{ width: '236px', height: '236px', objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '300px',
              height: '300px',
              background: 'rgba(255,255,255,0.14)',
              borderRadius: '56px',
              color: model.fg,
              fontSize: '180px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {model.initial}
          </div>
        )}

        {vName ? (
          <div
            style={{
              display: 'flex',
              marginTop: '44px',
              maxWidth: '1040px',
              color: model.fg,
              fontSize: '66px',
              fontWeight: 700,
              lineHeight: 1.08,
              textAlign: 'center',
            }}
          >
            {vName}
          </div>
        ) : null}

        {vType ? (
          <div
            style={{
              display: 'flex',
              marginTop: '10px',
              color: model.fg,
              opacity: 0.86,
              fontSize: '34px',
              fontWeight: 700,
            }}
          >
            {vType}
          </div>
        ) : null}

        {vServices.length ? (
          <div
            style={{
              display: 'flex',
              marginTop: '26px',
              gap: '14px',
              flexWrap: 'nowrap',
              justifyContent: 'center',
            }}
          >
            {vServices.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.18)',
                  color: model.fg,
                  fontSize: '26px',
                  fontWeight: 700,
                  padding: '10px 22px',
                  borderRadius: '999px',
                }}
              >
                {s}
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', marginTop: '30px' }}>{ctaPill}</div>
      </div>
    );

  return new ImageResponse(element, {
    ...size,
    ...(fonts.length ? { fonts } : {}),
  });
}
