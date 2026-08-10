import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * רכיבים טיפוגרפיים קטנים ומקומיים למדור המשפטי בלבד.
 * כולם רכיבי שרת סטטיים, ללא תלות בשרת פעיל או במסד נתונים,
 * ומיישרים סמנטיקה נכונה (h2 / h3 / p / ul / ol) ותצוגה תואמת RTL.
 */

/** מקטע תוכן בעל כותרת h2 ועוגן לניווט פנימי. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-10 scroll-mt-28 first:mt-0">
      <h2
        id={id}
        className="font-display text-2xl font-bold text-sand-900 dark:text-sand-50 sm:text-[1.7rem]"
      >
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** כותרת משנה h3 בתוך מקטע. */
export function LegalSubheading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 font-display text-lg font-bold text-sand-900 dark:text-sand-100">
      {children}
    </h3>
  );
}

/** פסקת טקסט משפטי. */
export function LegalText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('leading-relaxed text-sand-700 dark:text-sand-200', className)}>{children}</p>
  );
}

/** רשימה עם תבליטים או ממוספרת, תואמת יישור לימין. */
export function LegalList({
  children,
  ordered = false,
}: {
  children: ReactNode;
  ordered?: boolean;
}) {
  const base = 'space-y-2 ps-6 leading-relaxed text-sand-700 dark:text-sand-200 marker:text-sand-400';
  return ordered ? (
    <ol className={cn('list-decimal', base)}>{children}</ol>
  ) : (
    <ul className={cn('list-disc', base)}>{children}</ul>
  );
}

/** פריט ברשימה. */
export function LegalItem({ children }: { children: ReactNode }) {
  return <li className="ps-1">{children}</li>;
}
