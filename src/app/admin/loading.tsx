import { MascotState } from '@/components/brand/MascotState';
import { t } from '@/i18n';

// מסך טעינה לאזור הניהול — נטען בתוך שלד האדמין (סרגל צד נשמר).
export default function AdminLoading() {
  return (
    <MascotState
      pose="face"
      size={104}
      title={t.brand.states.loadingText}
      alt={t.brand.states.loadingAlt}
    />
  );
}
