import Image from 'next/image';
import { t } from '@/i18n';

/**
 * MascotTip — קאלאאוט ידידותי עם שון, הקמע-המדריך, לצד טיפ קצר.
 * דקורטיבי אנושית: התמונה נושאת alt תיאורי, והטקסט הוא התוכן.
 */
export function MascotTip({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const { sean, seanAlt } = t.marketing.mascots;

  return (
    <div
      className={`mx-auto flex max-w-xl items-center gap-4 text-start sm:gap-5 ${className}`}
    >
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-accent-100 to-accent-200/50 shadow-glow ring-4 ring-white/80 animate-float motion-reduce:animate-none sm:h-32 sm:w-32 dark:from-accent-900/40 dark:to-accent-950/20 dark:ring-sand-900/80">
        <Image
          src="/brand/mascots/sean-face.png"
          alt={seanAlt}
          width={320}
          height={320}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex-1 rounded-3xl border border-accent-200/70 bg-accent-50/70 p-4 pe-5 shadow-soft dark:border-accent-900/40 dark:bg-accent-950/20">
        <div className="mb-0.5 text-xs font-bold text-accent-700 dark:text-accent-300">
          {sean.name} · {sean.role}
        </div>
        <p className="text-sm leading-relaxed text-sand-700 dark:text-sand-200">{text}</p>
      </div>
    </div>
  );
}

export default MascotTip;
