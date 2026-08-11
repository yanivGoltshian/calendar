import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardProps = {
  children: ReactNode;
  className?: string;
  /** הבלטת הכרטיס בריחוף */
  interactive?: boolean;
} & HTMLAttributes<HTMLDivElement>;

/**
 * Card — משטח תוכן מוגבה עם פינות מעוגלות וצל רך.
 * עם interactive מתקבלת מיקרו-אינטראקציה עדינה בריחוף.
 */
export function Card({ children, className, interactive = false, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-sand-200/80 bg-white/90 p-6 shadow-soft',
        'dark:border-sand-700/70 dark:bg-sand-800/70',
        interactive &&
          'transition-all duration-300 ease-emphasized hover:-translate-y-1 hover:shadow-elevated hover:border-brand-200 dark:hover:border-brand-700',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
