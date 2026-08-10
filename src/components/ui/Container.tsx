import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ContainerProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

/** Container — עוטף תוכן ברוחב מרבי אחיד עם ריווח צדדי רספונסיבי. */
export function Container({ children, className, ...rest }: ContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8', className)} {...rest}>
      {children}
    </div>
  );
}

export default Container;
