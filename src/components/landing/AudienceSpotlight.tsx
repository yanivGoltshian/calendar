import Image from 'next/image';

/**
 * AudienceSpotlight — כרטיס קטגוריה מוגדל עם "דוגמן בית" אנושי (אדם/מאיה).
 * משמש להצגת תחומי ליבה בצורה מזמינה, לצד רשת אייקוני הקטגוריות הקוויות.
 */
export function AudienceSpotlight({
  src,
  alt,
  width,
  height,
  label,
  desc,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  label: string;
  desc: string;
}) {
  return (
    <div className="relative flex h-full min-h-[15rem] items-center gap-4 rounded-3xl border border-sand-200/70 bg-gradient-to-br from-white to-sand-50 p-6 shadow-soft transition-shadow hover:shadow-elevated sm:gap-5 sm:p-7 dark:border-sand-800/70 dark:from-sand-900 dark:to-sand-950">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -bottom-10 -end-8 h-44 w-44 rounded-full bg-accent-200/20 blur-2xl" />
      </div>
      <div className="relative flex-1">
        <h3 className="font-display text-xl font-bold text-sand-900 dark:text-sand-50 sm:text-2xl">
          {label}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-sand-600 dark:text-sand-300">{desc}</p>
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="relative h-44 w-auto shrink-0 self-end object-contain object-bottom drop-shadow-xl sm:h-52"
      />
    </div>
  );
}

export default AudienceSpotlight;
