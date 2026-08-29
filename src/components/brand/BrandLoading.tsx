import Image from 'next/image';

/**
 * מסך טעינה ממותג — מציג את סמל תור צ׳יק (במקום הקמע שון) עם פעימה עדינה.
 * רכיב תצוגה בלבד (ללא hooks) כדי שיהיה בטוח לייבוא משרת ומקליינט כאחד.
 * כובד prefers-reduced-motion דרך motion-reduce:animate-none. תמיד תוספתי.
 */
type BrandLoadingProps = {
  title: string;
  /** גובה/רוחב הסמל בפיקסלים (הסמל ריבועי). ברירת מחדל 112. */
  size?: number;
  alt?: string;
  className?: string;
};

export function BrandLoading({ title, size = 112, alt, className }: BrandLoadingProps) {
  const decorative = alt === undefined || alt === '';
  return (
    <div
      className={`flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center ${className ?? ''}`}
    >
      <Image
        src="/brand/torchick-emblem-navy-256.png"
        alt={decorative ? '' : (alt as string)}
        width={size}
        height={size}
        priority
        aria-hidden={decorative ? true : undefined}
        className="animate-pulse rounded-2xl shadow-sm ring-1 ring-slate-200 motion-reduce:animate-none"
      />
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
    </div>
  );
}

export default BrandLoading;
