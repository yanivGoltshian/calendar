import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

/**
 * Input — שדה קלט אחיד, נגיש ותקין ל-RTL, עם מצבי פוקוס עדינים.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-sand-300 bg-white px-4 py-3 text-sand-900',
        'placeholder:text-sand-400 shadow-sm transition-colors',
        'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
        'dark:border-sand-700 dark:bg-sand-800 dark:text-sand-50 dark:placeholder:text-sand-500',
        className,
      )}
      {...rest}
    />
  );
});

export default Input;
