import Link from 'next/link';
import { MascotState } from '@/components/brand/MascotState';
import { t } from '@/i18n';

// מסך "לא נמצא" כללי (App Router) עם שון וקישור חזרה לדף הבית.
export default function NotFound() {
  return (
    <MascotState
      pose="34"
      size={150}
      title={t.brand.states.notFoundTitle}
      body={t.brand.states.notFoundBody}
      alt={t.brand.states.notFoundAlt}
    >
      <Link
        href="/"
        className="mt-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {t.brand.states.notFoundCta}
      </Link>
    </MascotState>
  );
}
