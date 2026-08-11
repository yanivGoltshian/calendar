import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Badge (admin) — תג סטטוס קומפקטי בפלטת נייבי-זהב.
 * הגוונים מותאמים לסטטוסי תורים (ממתין/מאושר/הגיע/בוטל/הברזה/הושלם).
 */
type Tone = 'neutral' | 'gold' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-[#16233A] text-[#9AA7BD] border-[#16233A]',
  gold: 'bg-[#F2D695]/15 text-[#F2D695] border-[#C59D5F]/40',
  success: 'bg-[#1F3B2C] text-[#9BE3B4] border-[#2E5A43]/60',
  warning: 'bg-[#3A2F16] text-[#F2D695] border-[#82643C]/60',
  danger: 'bg-[#3A1C1C] text-[#F2B8B8] border-[#5A2E2E]/60',
  info: 'bg-[#16233A] text-[#9AC4F2] border-[#2E4A6A]/60',
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  children: ReactNode;
};

export function Badge({ tone = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
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
