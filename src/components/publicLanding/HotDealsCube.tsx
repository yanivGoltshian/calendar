import type { CSSProperties } from 'react';
import { ArrowLeftIcon } from './icons';

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
    <section
      id="lp-offers"
      dir="rtl"
      className="relative mt-16 scroll-mt-24 sm:mt-24"
      style={{
        width: '100vw',
        marginInline: 'calc(50% - 50vw)',
        overflowX: 'clip',
        background:
          'radial-gradient(1200px 500px at 15% -10%, rgba(198,168,106,0.20), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(176,133,95,0.22), transparent 55%), linear-gradient(160deg, #1b1513, #2c2420)',
        color: '#fff',
      }}
    >
      {/* רצועה כהה אופקית: טור טקסט זהב מימין, קובייה מסתובבת משמאל (RTL), קורסת לטור אחד במובייל */}
      <div className="mx-auto grid max-w-[1120px] items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2">
        <div className="order-2 text-center lg:order-1 lg:text-start">
          {eyebrow ? (
            <p className="text-sm font-extrabold tracking-wide text-[#c6a86a]">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 font-display text-3xl font-black leading-tight sm:text-4xl">{title}</h2>
          <span
            aria-hidden
            className="mx-auto mt-3 block h-[3px] w-20 rounded-full lg:mx-0"
            style={{ background: 'linear-gradient(90deg, #c6a86a, transparent)' }}
          />
          {text ? <p className="mx-auto mt-4 max-w-xl text-white/80 lg:mx-0">{text}</p> : null}
          <a
            href={ctaHref}
            className="group mt-6 inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-bold text-[#241d10] shadow-elevated transition hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(90deg, #a6863f, #c6a86a)' }}
          >
            {ctaLabel}
            <ArrowLeftIcon className="h-4 w-4 transition group-hover:-translate-x-1" />
          </a>
        </div>

        {/* במה תלת-ממדית עם פרספקטיבה; גובה קבוע מונע קפיצת פריסה */}
        <div className="order-1 flex items-center justify-center lg:order-2" style={{ perspective: '1000px' }}>
          <div aria-hidden className="relative motion-safe:animate-cube-spin" style={cubeStyle}>
            {faces.map((src, i) => (
              <div
                key={i}
                className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-[color:var(--c-gold,#c6a86a)] bg-black/20 shadow-elevated"
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
      </div>
    </section>
  );
}
