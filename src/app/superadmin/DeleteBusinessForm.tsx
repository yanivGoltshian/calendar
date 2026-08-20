'use client';

import { useState } from 'react';
import { t as he } from '@/i18n';
import { isSlugConfirmed } from './logic';
import { deleteBusinessAction } from './actions';

const t = he.billing.superadmin.delete;

type Props = {
  businessId: string;
  slug: string;
  inputClass: string;
  inputStyle: React.CSSProperties;
};

/**
 * טופס מחיקת עסק בצד לקוח: כפתור המחיקה נעול עד שהמשתמש מקליד את ה-slug המדויק.
 * האישור נאכף גם בשרת (deleteBusinessAction) — זהו שכבת בטיחות נוספת ב-UX.
 */
export function DeleteBusinessForm({ businessId, slug, inputClass, inputStyle }: Props) {
  const [typed, setTyped] = useState('');
  const confirmed = isSlugConfirmed(typed, slug);

  return (
    <form action={deleteBusinessAction} className="mt-2 grid gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <p className="text-sm leading-relaxed" style={{ color: '#F0B5B5' }}>
        {t.warning}
      </p>
      <label className="grid gap-1 text-sm">
        <span>
          {t.confirmLabel} <span className="font-mono font-bold">{slug}</span>
        </span>
        <input
          name="confirmSlug"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={t.confirmPlaceholder}
          autoComplete="off"
          className={inputClass}
          style={inputStyle}
          dir="ltr"
        />
      </label>
      <button
        type="submit"
        disabled={!confirmed}
        className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: confirmed ? '#B4232A' : '#5A2327', color: '#FFF1F1' }}
      >
        {t.submit}
      </button>
    </form>
  );
}
