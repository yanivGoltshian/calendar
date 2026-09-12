'use client';

import { useId, useState } from 'react';
import { normalizeHex, toColorInputValue } from '@/lib/hexColor';
import { inputClass } from './fieldStyles';
import { BrandPalettePicker } from './BrandPalettePicker';
import { themeFromBrandColor } from '@/lib/branding';
import type { LandingTheme } from '@/lib/publicPageStyle';

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
  defaultTheme,
}: {
  name: string;
  defaultValue: string;
  /** צבע ברירת המחדל של המותג, להצגה בדגימה כשהערך ריק. */
  fallback: string;
  resetLabel: string;
  emptyLabel: string;
  defaultTheme?: LandingTheme;
}) {
  const [value, setValue] = useState<string>(defaultValue ?? '');
  const [theme, setTheme] = useState(defaultTheme);
  const swatch = toColorInputValue(value, fallback);
  const inputId = useId();
  function changeColor(next: string) {
    setValue(next);
    if (next !== value && (normalizeHex(next) || next === '')) setTheme(themeFromBrandColor(next || fallback));
  }

  return (
    <div className="space-y-4">
      <BrandPalettePicker color={value} theme={theme} onChange={(color, palette) => {
        setValue(color);
        setTheme(palette);
      }} />
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
          onChange={(e) => changeColor(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>

      <input
        name={name}
        dir="ltr"
        inputMode="text"
        value={value}
        onChange={(e) => changeColor(normalizeHex(e.target.value) ?? e.target.value)}
        onBlur={(e) => {
          const normalized = normalizeHex(e.target.value);
          changeColor(normalized ?? '');
        }}
        placeholder="#1c1512"
        className={`${inputClass} w-32 flex-none uppercase`}
      />

      {value ? (
        <button
          type="button"
          onClick={(event) => {
            changeColor('');
            event.currentTarget.dispatchEvent(new Event('input', { bubbles: true }));
          }}
          className="text-xs font-medium text-[#8f8478] underline-offset-2 hover:text-[#4a4038] hover:underline"
        >
          {resetLabel}
        </button>
      ) : (
        <span className="text-xs text-[#b3a690]">{emptyLabel}</span>
      )}
      </div>
    </div>
  );
}
