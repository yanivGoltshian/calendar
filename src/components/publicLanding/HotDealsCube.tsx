import type { ReactNode } from 'react';
import { ArrowLeftIcon } from './icons';

type Props = {
  eyebrow?: string;
  title: string;
  text?: string;
  ctaLabel: string;
  ctaHref: string;
  images: string[]; // עד שש תמונות טיפולים; אופן התצוגה נגזר ממספר התמונות
};

// גודל הבמה בפיקסלים והיסט הפאה (חצי מהגודל) לבניית הגופים התלת-ממדיים.
const CUBE = 230;
const HALF = CUBE / 2;
// עומק פאה במנסרה המשולשת — הרדיוס הפנימי של משולש שווה-צלעות שרוחב צלעו CUBE.
const PRISM_DEPTH = Math.round(HALF / Math.tan(Math.PI / 3)); // ≈ 66

// גובה קבוע לכל במה — שומר מקום יציב בפריסה כך שהסיבוב לא ידחוף את שאר העמוד.
const STAGE = 260;
const CUBE_STAGE = 300;

// טרנספורם קבוע לשש פאות הקובייה (front/back/right/left/top/bottom).
const FACE_TRANSFORMS = [
  `translateZ(${HALF}px)`,
  `rotateY(180deg) translateZ(${HALF}px)`,
  `rotateY(90deg) translateZ(${HALF}px)`,
  `rotateY(-90deg) translateZ(${HALF}px)`,
  `rotateX(90deg) translateZ(${HALF}px)`,
  `rotateX(-90deg) translateZ(${HALF}px)`,
] as const;

// שלוש פאות המנסרה המשולשת, בהפרשי 120° ובעומק הרדיוס הפנימי.
const PRISM_FACE_TRANSFORMS = [
  `rotateY(0deg) translateZ(${PRISM_DEPTH}px)`,
  `rotateY(120deg) translateZ(${PRISM_DEPTH}px)`,
  `rotateY(240deg) translateZ(${PRISM_DEPTH}px)`,
] as const;

// מסגרת פאה אחידה — פינות מעוגלות, מסגרת זהב, רקע כהה וצל.
const FRAME =
  'absolute inset-0 overflow-hidden rounded-2xl border-2 border-[color:var(--c-gold,#c6a86a)] bg-[#1b1513] shadow-elevated';

// תמונת פאה עם מידות מפורשות (מונע CLS) ושכבת גרדיאנט עדינה לקריאוּת.
function FaceImg({ src }: { src: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={CUBE}
        height={CUBE}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent"
      />
    </>
  );
}

// מעטפת במה משותפת — פרספקטיבה, מרכוז וגובה קבוע (יציבות פריסה).
function Stage({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div className="flex items-center justify-center" style={{ height, perspective: '1000px' }}>
      {children}
    </div>
  );
}

// תמונה אחת — ללא קובייה: תצוגה יחידה במסגרת עם הופעה רכה וריחוף/הגדלה עדינים.
function SingleStage({ src }: { src: string }) {
  return (
    <Stage height={STAGE}>
      <div className="relative motion-safe:animate-fade-up" style={{ width: CUBE, height: CUBE }}>
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-[2rem] blur-2xl"
          style={{ background: 'radial-gradient(closest-side, rgba(198,168,106,0.35), transparent)' }}
        />
        <div
          aria-hidden
          className="relative h-full w-full motion-safe:animate-image-breathe"
          style={{ willChange: 'transform' }}
        >
          <div className={FRAME}>
            <FaceImg src={src} />
          </div>
        </div>
      </div>
    </Stage>
  );
}

// שתי תמונות — מעבר "דפדוף ספר": כרטיס מתהפך על ציר Y בין שתי התמונות.
function BookStage({ front, back }: { front: string; back: string }) {
  return (
    <Stage height={STAGE}>
      <div
        aria-hidden
        className="relative motion-safe:animate-book-flip"
        style={{
          width: CUBE,
          height: CUBE,
          transformStyle: 'preserve-3d',
          transform: 'rotateY(0deg)',
          willChange: 'transform',
        }}
      >
        <div className={FRAME} style={{ backfaceVisibility: 'hidden' }}>
          <FaceImg src={front} />
        </div>
        <div className={FRAME} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <FaceImg src={back} />
        </div>
      </div>
    </Stage>
  );
}

// שלוש תמונות — מנסרה משולשת מסתובבת, פאה לכל תמונה.
function PrismStage({ faces }: { faces: string[] }) {
  return (
    <Stage height={STAGE}>
      <div
        aria-hidden
        className="relative motion-safe:animate-prism-spin"
        style={{
          width: CUBE,
          height: CUBE,
          transformStyle: 'preserve-3d',
          transform: 'rotateY(0deg)',
          willChange: 'transform',
        }}
      >
        {faces.map((src, i) => (
          <div
            key={i}
            className={FRAME}
            style={{ transform: PRISM_FACE_TRANSFORMS[i], backfaceVisibility: 'hidden' }}
          >
            <FaceImg src={src} />
          </div>
        ))}
      </div>
    </Stage>
  );
}

// ארבע תמונות ומעלה — קובייה מסתובבת; שש הפאות מתמלאות במחזוריות מהגלריה (ללא פאות ריקות).
function CubeStage({ faces }: { faces: string[] }) {
  return (
    <Stage height={CUBE_STAGE}>
      <div
        aria-hidden
        className="relative motion-safe:animate-cube-spin"
        style={{
          width: CUBE,
          height: CUBE,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(-14deg) rotateY(0deg)',
          willChange: 'transform',
        }}
      >
        {faces.map((src, i) => (
          <div
            key={i}
            className={FRAME}
            style={{ transform: FACE_TRANSFORMS[i], backfaceVisibility: 'hidden' }}
          >
            <FaceImg src={src} />
          </div>
        ))}
      </div>
    </Stage>
  );
}

// מקטע "מבצעים חמים" — תצוגת תמונות תלת-ממדית שמסתעפת לפי מספר התמונות:
// 1=תמונה יחידה, 2=דפדוף ספר, 3=מנסרה משולשת, 4+=קובייה. הבמה דקורטיבית
// (aria-hidden) והתוכן המשמעותי (כותרת, טקסט, CTA) נגיש כטקסט. מכבד
// prefers-reduced-motion: תחת motion-reduce התנועה מבוטלת והבמה נחה בזווית מייצגת.
export default function HotDealsCube({ eyebrow, title, text, ctaLabel, ctaHref, images }: Props) {
  const imgs = images.filter(Boolean).slice(0, 6);
  if (imgs.length === 0) return null;

  // אופן התצוגה נגזר ממספר התמונות; כל מצב מייצב מקום קבוע בפריסה.
  let stage: ReactNode;
  if (imgs.length === 1) {
    stage = <SingleStage src={imgs[0]} />;
  } else if (imgs.length === 2) {
    stage = <BookStage front={imgs[0]} back={imgs[1]} />;
  } else if (imgs.length === 3) {
    stage = <PrismStage faces={imgs} />;
  } else {
    // ממלאים בדיוק שש פאות במחזוריות מהגלריה כדי שלא תישאר פאה כהה ריקה.
    const cubeFaces = Array.from({ length: 6 }, (_, i) => imgs[i % imgs.length]);
    stage = <CubeStage faces={cubeFaces} />;
  }

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

        {/* עמודת המדיה — תצוגה תלת-ממדית מסתעפת לפי מספר התמונות; גובה קבוע מונע קפיצת פריסה */}
        <div className="order-1 lg:order-2" style={{ contain: 'layout' }}>
          {stage}
        </div>
      </div>
    </section>
  );
}
