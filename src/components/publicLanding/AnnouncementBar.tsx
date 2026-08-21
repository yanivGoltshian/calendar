'use client';

import { useEffect, useState } from 'react';

// גיבוב קצר ויציב לטקסט — מפתח האחסון המקומי משתנה עם שינוי ההודעה,
// כך שעדכון חדש יוצג שוב גם למי שסגר את הקודם.
function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

type Props = {
  text: string;
  dismissAria?: string;
};

// שורת עדכון חי לראש עמוד העסק — נשלטת מעמוד ניהול העסק.
// ניתנת לסגירה על ידי המבקר (נשמר מקומית בדפדפן).
export default function AnnouncementBar({ text, dismissAria }: Props) {
  const message = (text ?? '').trim();
  const storageKey = message ? `tc-annc-${hashText(message)}` : '';
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (window.localStorage.getItem(storageKey) === '1') setHidden(true);
    } catch {
      /* אחסון חסום — מציגים בכל זאת */
    }
  }, [storageKey]);

  if (!message || hidden) return null;

  const dismiss = () => {
    try {
      if (storageKey) window.localStorage.setItem(storageKey, '1');
    } catch {
      /* מתעלמים */
    }
    setHidden(true);
  };

  return (
    <div
      dir="rtl"
      role="status"
      className="mt-4 flex items-start gap-3 rounded-2xl border border-[color:var(--biz-border,#e7ddcf)] bg-[color:var(--biz-soft,#fbf6ee)] px-4 py-3 text-[color:var(--biz-ink-strong,#3a3226)] shadow-soft"
    >
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--biz-strong,#b6894e)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1Z" strokeLinejoin="round" />
        <path d="M15 8a4 4 0 0 1 0 8" strokeLinecap="round" />
      </svg>
      <p className="flex-1 text-sm font-medium leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={dismissAria ?? 'סגירת ההודעה'}
        className="shrink-0 rounded-full p-1 text-[color:var(--biz-ink,#6b6152)] transition hover:bg-black/5"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
