import { BrandLoading } from '@/components/brand/BrandLoading';
import { t } from '@/i18n';

// מסך טעינה לאזור הניהול — סמל תור צ׳יק בתוך שלד האדמין (סרגל צד נשמר).
export default function AdminLoading() {
  return (
    <BrandLoading size={104} title={t.brand.states.loadingText} alt={t.brand.states.loadingAlt} />
  );
}
