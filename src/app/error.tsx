'use client';

import { MascotState } from '@/components/brand/MascotState';
import { t } from '@/i18n';

// מסך שגיאה כללי (App Router). חייב להיות client component לפי Next.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <MascotState
      pose="face"
      size={120}
      title={t.brand.states.errorTitle}
      body={t.brand.states.errorBody}
      alt={t.brand.states.errorAlt}
    >
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {t.brand.states.retry}
      </button>
    </MascotState>
  );
}
