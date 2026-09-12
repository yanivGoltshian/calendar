'use client';

import { useId, type ReactNode } from 'react';
import { t } from '@/i18n';

export default function InfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <>
      <button type="button" popoverTarget={id} aria-label={`${t.common.moreInfo}: ${label}`}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
        <span aria-hidden="true">i</span>
      </button>
      <div id={id} popover="auto" role="dialog" aria-label={label} dir="rtl"
        className="m-auto max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[#d6c8b4] bg-white p-4 text-sm leading-relaxed text-[#4a4038] shadow-xl">
        {children}
      </div>
    </>
  );
}
