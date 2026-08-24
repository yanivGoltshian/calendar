import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Input (admin) — שדה קלט בפלטת נייבי-זהב, עם תווית ושגיאה אופציונליות.
 * תקין ל-RTL (יישור לימין) ונגיש (קישור label↔input, aria-invalid).
 */
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  containerClassName?: string;
};

const fieldClasses =
  'w-full rounded-xl bg-[#1c1512] text-[#f3ece0] placeholder:text-[#c9b79f]/70 ' +
  'border border-[#2f241d] px-4 py-2.5 text-base text-right ' +
  'transition-colors duration-200 outline-none ' +
  'focus:border-[#C59D5F] focus:ring-2 focus:ring-[#C59D5F]/40 ' +
  'disabled:opacity-50 disabled:pointer-events-none ' +
  'aria-[invalid=true]:border-[#F2B8B8] aria-[invalid=true]:ring-[#F2B8B8]/30';

export function Input({ label, error, hint, id, className, containerClassName, ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-[#f3ece0]">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(fieldClasses, className)}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? (
        <span className="text-sm text-[#F2B8B8]">{error}</span>
      ) : hint ? (
        <span className="text-sm text-[#c9b79f]">{hint}</span>
      ) : null}
    </div>
  );
}

export default Input;
