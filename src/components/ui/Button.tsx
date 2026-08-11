import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold ' +
  'transition-all duration-300 ease-emphasized select-none whitespace-nowrap ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-sand-50 ' +
  'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-glow-soft hover:shadow-glow hover:-translate-y-0.5',
  secondary:
    'bg-white text-sand-900 border border-sand-200 shadow-soft hover:border-brand-300 ' +
    'hover:-translate-y-0.5 dark:bg-sand-800 dark:text-sand-50 dark:border-sand-700',
  outline:
    'border-2 border-brand-600 text-brand-700 hover:bg-brand-50 ' +
    'dark:text-brand-200 dark:border-brand-400 dark:hover:bg-brand-950/40',
  ghost:
    'text-sand-700 hover:bg-sand-100 dark:text-sand-200 dark:hover:bg-sand-800/60',
  accent:
    'bg-accent-400 text-sand-950 shadow-soft hover:bg-accent-300 hover:-translate-y-0.5',
};

const sizes: Record<Size, string> = {
  sm: 'text-sm px-4 py-2',
  md: 'text-base px-6 py-3',
  lg: 'text-lg px-8 py-4',
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string };

type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * Button — כפתור אחיד עם וריאנטים וגדלים, מיקרו-אינטראקציות עדינות בריחוף,
 * נגיש ותקין ל-RTL. מתרנדר כ-<a> כשמסופק href, אחרת כ-<button>.
 */
export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if ('href' in rest && rest.href !== undefined) {
    return (
      <a className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}

export default Button;
