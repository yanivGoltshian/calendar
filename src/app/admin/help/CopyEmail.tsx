'use client';

import { useState } from 'react';

/**
 * מציג את כתובת המייל של התמיכה כטקסט להעתקה בלבד (ללא קישור mailto),
 * כדי שלחיצה לא תפעיל את בורר "פתיחה באמצעות" של מערכת ההפעלה. כפתור ההעתקה
 * מעתיק ללוח וגם בוחר את הטקסט כגיבוי במכשירים ללא הרשאת clipboard.
 */
export default function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const sel = window.getSelection();
      const node = document.getElementById('tc-help-email');
      if (sel && node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2">
      <code
        id="tc-help-email"
        dir="ltr"
        className="flex-1 select-all text-sm font-medium text-[var(--ink)]"
      >
        {email}
      </code>
      <button
        type="button"
        onClick={copy}
        className="rounded-lg bg-[var(--navy)] px-3 py-1.5 text-sm font-semibold text-white"
      >
        {copied ? 'הועתק' : 'העתקה'}
      </button>
    </div>
  );
}
