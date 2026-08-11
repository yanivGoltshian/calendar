import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Button (admin) — כפתור בפלטת נייבי-זהב לאזור הניהול.
 * מתרנדר כ-<a> כשמסופק href, אחרת כ-<button>. תקין ל-RTL ונגיש.
 */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold ' +
  'transition-all duration-200 select-none whitespace-nowrap ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59D5F] ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1526] ' +
  'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

const variants: Record<Variant, string> = {
  // זהב מלא על נייבי — פעולה ראשית
  primary:
    'bg-[#F2D695] text-[#0B1526] shadow-sm hover:bg-[#C59D5F] hover:-translate-y-0.5',
  // משטח נייבי בהיר עם מסגרת זהב עדינה
  secondary:
    'bg-[#16233A] text-[#E8ECF3] border border-[#C59D5F]/40 hover:border-[#C59D5F] hover:-translate-y-0.5',
  // מתאר זהב בלבד
  outline:
    'border border-[#C59D5F] text-[#F2D695] hover:bg-[#16233A]',
  // שקוף
  ghost: 'text-[#E8ECF3] hover:bg-[#16233A]',
  // מסוכן — אדום מאופק על נייבי
  danger:
    'bg-transparent text-[#F2B8B8] border border-[#F2B8B8]/40 hover:bg-[#F2B8B8]/10',
};

const sizes: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-base px-5 py-2.5',
  lg: 'text-lg px-7 py-3.5',
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type AsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };
type AsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & { href: string };

type ButtonProps = AsButton | AsLink;

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
