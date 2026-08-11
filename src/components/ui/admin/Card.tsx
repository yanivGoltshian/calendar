import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Card (admin) — משטח נייבי עם מסגרת עדינה וזוהר קל, לאזור הניהול.
 * כולל תת-רכיבים אופציונליים לכותרת/גוף/כותרת תחתונה.
 */
type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-[#0B1526] border border-[#16233A] shadow-lg shadow-black/20',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'px-5 py-4 border-b border-[#16233A] flex items-center justify-between gap-3',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg font-semibold text-[#F2D695]', className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardBody({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn('px-5 py-4 text-[#E8ECF3]', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('px-5 py-4 border-t border-[#16233A] flex items-center gap-3', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export default Card;
