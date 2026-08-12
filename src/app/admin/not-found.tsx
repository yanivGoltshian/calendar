import Link from 'next/link';
import { MascotState } from '@/components/brand/MascotState';
import { t } from '@/i18n';

// מסך "לא נמצא" לאזור הניהול — נשמר בתוך שלד האדמין, עם קישור חזרה ללוח.
export default function AdminNotFound() {
  return (
    <MascotState
      pose="34"
      size={140}
      title={t.brand.states.notFoundTitle}
      body={t.brand.states.notFoundBody}
      alt={t.brand.states.notFoundAlt}
    >
      <Link
        href="/admin"
        className="mt-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {t.brand.states.adminHomeCta}
      </Link>
    </MascotState>
  );
}
