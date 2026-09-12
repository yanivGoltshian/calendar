'use client';

import { t } from '@/i18n';
import { themeFromBrandColor } from '@/lib/branding';
import type { LandingTheme } from '@/lib/publicPageStyle';
import { BRAND_PRESETS } from '../onboarding/premium';

const PRIMARY_SWATCHES = [
  '#1c1512', '#12b886', '#7c3aed', '#e11d48', '#f59e0b', '#0ea5e9',
  '#b0855f', '#d98ca3', '#3f9d8a', '#3b82c4', '#9b3b57', '#2fa9a2',
];

export function BrandPalettePicker({
  color,
  theme,
  onChange,
}: {
  color: string;
  theme?: LandingTheme;
  onChange: (color: string, theme: LandingTheme) => void;
}) {
  const labels = t.admin.onboarding.premium.palette;
  function select(element: HTMLButtonElement, next: LandingTheme) {
    onChange(next.brand, next);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  return (
    <div className="space-y-4" data-testid="brand-palette-picker">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-[#4a4038]">{labels.presetsTitle}</span>
        <p className="mb-2 text-xs text-[#b3a690]">{labels.presetsHint}</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {BRAND_PRESETS.map(preset => {
            const selected = theme !== undefined && Object.entries(preset.theme)
              .every(([key, value]) => theme[key as keyof LandingTheme]?.toLowerCase() === value.toLowerCase());
            return (
              <button key={preset.id} type="button" aria-pressed={selected}
                onClick={event => select(event.currentTarget, preset.theme)}
                className={'flex flex-col gap-2 rounded-2xl border p-3 text-right transition ' +
                  (selected ? 'border-[#1b1715] ring-2 ring-[#1b1715] ring-offset-1' :
                    'border-[#e7ddcd] hover:border-[#b3a690]')}>
                <span className="flex gap-1" aria-hidden="true">
                  {[preset.theme.brand, preset.theme.brandDark, preset.theme.gold, preset.theme.accent, preset.theme.cream]
                    .map((value, index) => <span key={index} className="h-5 w-5 rounded-full ring-1 ring-black/5"
                      style={{ backgroundColor: value }} />)}
                </span>
                <span className="text-xs font-medium text-[#4a4038]">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-[#4a4038]">{labels.primaryTitle}</span>
        <p className="mb-2 text-xs text-[#b3a690]">{labels.primaryHint}</p>
        <div className="flex flex-wrap gap-2.5">
          {PRIMARY_SWATCHES.map(swatch => (
            <button key={swatch} type="button" aria-label={swatch}
              aria-pressed={color.toLowerCase() === swatch}
              onClick={event => select(event.currentTarget, themeFromBrandColor(swatch))}
              style={{ backgroundColor: swatch }}
              className={'h-10 w-10 rounded-full ring-offset-2 transition ' +
                (color.toLowerCase() === swatch ? 'ring-2 ring-[#1b1715]' : 'ring-1 ring-[#e7ddcd] hover:ring-[#b3a690]')} />
          ))}
        </div>
      </div>
      <input type="hidden" name="landingTheme" value={JSON.stringify(theme ?? null)} />
    </div>
  );
}
