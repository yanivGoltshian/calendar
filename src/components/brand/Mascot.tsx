import Image from 'next/image';

/**
 * רכיב מותג יחיד ל"שון", הקמע של תור צ׳יק.
 * מרכז את כל הופעות הקמע במוצר (מצבים ריקים, רגעי הצלחה, מסכי מצב, אונבורדינג)
 * כדי לשמור על סגנון עקבי, עדין ומקצועי. תמיד תוספתי — ללא לוגיקה עסקית.
 *
 * pose  — בוחר את קובץ ה-PNG הקיים (לא מייצרים אמנות חדשה).
 * size  — גובה התצוגה בפיקסלים; הרוחב נגזר מיחס הממדים המקורי כדי למנוע עיוות.
 * alt   — טקסט חלופי בעברית. כשמושמט, הקמע דקורטיבי (alt="" + aria-hidden).
 * circle — מסגור עגול (לרגעי הצלחה), בדומה לתצוגת ה-MascotTip בדף הנחיתה.
 */

export type MascotPose = 'head' | 'face' | 'wink' | 'full' | '34';

type PoseMeta = { src: string; w: number; h: number };

const POSES: Record<MascotPose, PoseMeta> = {
  head: { src: '/brand/mascots/sean-head.png', w: 197, h: 295 },
  face: { src: '/brand/mascots/sean-face.png', w: 320, h: 320 },
  wink: { src: '/brand/mascots/sean-wink.png', w: 512, h: 512 },
  full: { src: '/brand/mascots/sean-full.png', w: 236, h: 556 },
  '34': { src: '/brand/mascots/sean-34.png', w: 214, h: 558 },
};

type MascotProps = {
  pose?: MascotPose;
  /** גובה התצוגה בפיקסלים (ברירת מחדל 96). */
  size?: number;
  /** טקסט חלופי בעברית; מושמט => דקורטיבי. */
  alt?: string;
  /** מסגור עגול עם object-cover (מתאים לרגעי הצלחה). */
  circle?: boolean;
  className?: string;
  priority?: boolean;
};

export function Mascot({
  pose = 'head',
  size = 96,
  alt,
  circle = false,
  className,
  priority = false,
}: MascotProps) {
  const meta = POSES[pose];
  const decorative = alt === undefined || alt === '';
  const imgAlt = decorative ? '' : alt;

  if (circle) {
    const box = size;
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className ?? ''}`}
        style={{ width: box, height: box }}
        aria-hidden={decorative ? true : undefined}
      >
        <Image
          src={meta.src}
          alt={imgAlt}
          width={meta.w}
          height={meta.h}
          priority={priority}
          className="h-full w-full object-cover object-top"
        />
      </span>
    );
  }

  const width = Math.round((size * meta.w) / meta.h);
  return (
    <Image
      src={meta.src}
      alt={imgAlt}
      width={width}
      height={size}
      priority={priority}
      aria-hidden={decorative ? true : undefined}
      className={className}
    />
  );
}

export default Mascot;
