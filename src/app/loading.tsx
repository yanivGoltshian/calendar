import { MascotState } from '@/components/brand/MascotState';
import { t } from '@/i18n';

// מסך טעינה כללי (App Router) עם שון, במקום ספינר חשוף.
export default function Loading() {
  return (
    <MascotState
      pose="face"
      size={112}
      title={t.brand.states.loadingText}
      alt={t.brand.states.loadingAlt}
    />
  );
}
