'use client';

import { useId, useState } from 'react';
import { normalizeHex, toColorInputValue } from '@/lib/hexColor';
import { inputClass } from './fieldStyles';

/**
 * בורר צבע אינטואיטיבי: לחיצה על הדגימה פותחת בורר מערכת, לצד שדה HEX ידני.
 * שומר בדיוק את מחרוזת ה-HEX שהשרת כבר מאחסן (ריק = חזרה לצבע ברירת המחדל).
 */
export function BrandColorField({
  name,
  defaultValue,
  fallback,
  resetLabel,
  emptyLabel,
}: {
  name: string;
  defaultValue: string;
  /** צבע ברירת המחדל של המותג, להצגה בדגימה כשהערך ריק. */
  fallback: string;
  resetLabel: string;
  emptyLabel: string;
}) {
  const [value, setValue] = useState<string>(defaultValue ?? '');
  const swatch = toColorInputValue(value, fallback);
  const inputId = useId();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label
        className="relative h-10 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[#d6c8b4] shadow-inner"
        style={{ backgroundColor: swatch }}
        aria-label={emptyLabel}
        htmlFor={inputId}
      >
        <input
          id={inputId}
          type="color"
          value={swatch}
          onChange={(e) => setValue(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <input
        name={name}
        dir="ltr"
        inputMode="text"
        value={value}
        onChange={(e) => setValue(normalizeHex(e.target.value) ?? e.target.value)}
        onBlur={(e) => {
          const normalized = normalizeHex(e.target.value);
          setValue(normalized ?? '');
        }}
        placeholder="#1c1512"
        className={`${inputClass} w-32 flex-none uppercase`}
      />

      {value ? (
        <button
          type="button"
          onClick={() => setValue('')}
          className="text-xs font-medium text-[#8f8478] underline-offset-2 hover:text-[#4a4038] hover:underline"
        >
          {resetLabel}
        </button>
      ) : (
        <span className="text-xs text-[#b3a690]">{emptyLabel}</span>
      )}
    </div>
  );
}
