import type { CSSProperties } from 'react';
import { SparklesIcon, ArrowLeftIcon } from './icons';
import SectionHeading from './SectionHeading';

type Props = {
  eyebrow?: string;
  title: string;
  text?: string;
  ctaLabel: string;
  ctaHref: string;
  images: string[]; // עד שש תמונות טיפולים לפאות הקובייה
};

// גודל הקובייה בפיקסלים והיסט הפאה (חצי מהגודל) לבניית הקובייה התלת-ממדית.
const CUBE = 230;
const HALF = CUBE / 2;

// טרנספורם קבוע לכל אחת משש פאות הקובייה (front/back/right/left/top/bottom).
const FACE_TRANSFORMS = [
  `translateZ(${HALF}px)`,
  `rotateY(180deg) translateZ(${HALF}px)`,
  `rotateY(90deg) translateZ(${HALF}px)`,
  `rotateY(-90deg) translateZ(${HALF}px)`,
  `rotateX(90deg) translateZ(${HALF}px)`,
  `rotateX(-90deg) translateZ(${HALF}px)`,
] as const;

// מקטע "מבצעים חמים" — קובייה תלת-ממדית מסתובבת עם שש תמונות הטיפולים.
// בלוק inline (לא LandingSectionKey חדש). הקובייה דקורטיבית (aria-hidden),
// והתוכן המשמעותי (כותרת, טקסט, CTA) נגיש כטקסט. מכבד prefers-reduced-motion:
// תחת motion-reduce הסיבוב מבוטל והקובייה נחה בזווית מייצגת (ללא layout shift).
export default function HotDealsCube({ eyebrow, title, text, ctaLabel, ctaHref, images }: Props) {
  const faces = images.slice(0, 6);
  if (faces.length === 0) return null;

  // בסיס הקובייה תואם את שלב ה-0% של keyframes כדי שגם במצב מנוחה תוצג פאה נאה.
  const cubeStyle: CSSProperties = {
    width: CUBE,
    height: CUBE,
    transformStyle: 'preserve-3d',
    transform: 'rotateX(-14deg) rotateY(0deg)',
  };

  return (
    <section className="mt-16 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} lede={text} icon={<SparklesIcon className="h-4 w-4" />} />

      {/* במה תלת-ממדית ממורכזת עם פרספקטיבה; גובה קבוע מונע קפיצת פריסה */}
      <div className="mt-12 flex items-center justify-center" style={{ perspective: '1000px' }}>
        <div
          aria-hidden
          className="relative motion-safe:animate-cube-spin"
          style={cubeStyle}
        >
          {faces.map((src, i) => (
            <div
              key={i}
              className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-[color:var(--c-gold,var(--biz))] bg-[color:var(--biz-soft)] shadow-elevated"
              style={{ transform: FACE_TRANSFORMS[i], backfaceVisibility: 'hidden' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 flex justify-center">
        <a
          href={ctaHref}
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[color:var(--biz)] to-[color:var(--biz-strong)] px-8 py-3.5 text-base font-bold text-[color:var(--biz-ink)] shadow-elevated transition hover:-translate-y-0.5"
        >
          {ctaLabel}
          <ArrowLeftIcon className="h-4 w-4 transition group-hover:-translate-x-1" />
        </a>
      </div>
    </section>
  );
}
