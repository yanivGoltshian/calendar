import type { ReactNode } from 'react';

type Props = {
  eyebrow?: string;
  title: string;
  lede?: string;
  icon?: ReactNode;
  align?: 'center' | 'start';
};

// כותרת מקטע אלגנטית לעמוד הפרימיום — עינית קטנה, כותרת בפונט התצוגה,
// קו גרדיאנט דק בצבע המותג ולד אופציונלי. מונעת חזרתיות בין המקטעים.
export default function SectionHeading({ eyebrow, title, lede, icon, align = 'center' }: Props) {
  const centered = align === 'center';
  return (
    <div className={centered ? 'text-center' : 'text-start'}>
      {eyebrow ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--biz-strong)]">
          {icon}
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={`${eyebrow ? 'mt-2.5' : ''} font-display text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl`}
      >
        {title}
      </h2>
      <span
        aria-hidden
        className={`mt-4 block h-0.5 w-16 rounded-full bg-gradient-to-l from-[color:var(--biz)] to-[color:var(--biz-strong)] ${centered ? 'mx-auto' : ''}`}
      />
      {lede ? (
        <p
          className={`mt-4 text-sm leading-relaxed text-slate-600 sm:text-base ${centered ? 'mx-auto max-w-xl' : 'max-w-xl'}`}
        >
          {lede}
        </p>
      ) : null}
    </div>
  );
}
