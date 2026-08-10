import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'brand' | 'accent' | 'neutral';

type BadgeProps = {
  children: ReactNode;
  className?: string;
  tone?: Tone;
} & HTMLAttributes<HTMLSpanElement>;

const tones: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-950/50 dark:text-brand-200 dark:ring-brand-800',
  accent: 'bg-accent-50 text-accent-700 ring-1 ring-accent-100 dark:bg-accent-950/40 dark:text-accent-200 dark:ring-accent-800',
  neutral: 'bg-sand-100 text-sand-700 ring-1 ring-sand-200 dark:bg-sand-800 dark:text-sand-200 dark:ring-sand-700',
};

/** Badge — תווית קטנה להדגשת סטטוס או קטגוריה. */
export function Badge({ children, className, tone = 'brand', ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export default Badge;
