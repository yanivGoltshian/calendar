import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SectionProps = {
  children: ReactNode;
  className?: string;
  /** ריפוד אנכי */
  spacing?: 'sm' | 'md' | 'lg';
} & HTMLAttributes<HTMLElement>;

const spacings = {
  sm: 'py-12 sm:py-16',
  md: 'py-16 sm:py-24',
  lg: 'py-24 sm:py-32',
};

/** Section — קטע עמוד עם ריווח אנכי אחיד וקצב חלל עקבי. */
export function Section({ children, className, spacing = 'md', ...rest }: SectionProps) {
  return (
    <section className={cn(spacings[spacing], className)} {...rest}>
      {children}
    </section>
  );
}

export default Section;
