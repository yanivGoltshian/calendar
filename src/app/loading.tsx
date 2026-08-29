import { BrandLoading } from '@/components/brand/BrandLoading';
import { t } from '@/i18n';

// מסך טעינה כללי (App Router) עם סמל תור צ׳יק, במקום ספינר חשוף.
export default function Loading() {
  return <BrandLoading size={112} title={t.brand.states.loadingText} alt={t.brand.states.loadingAlt} />;
}
