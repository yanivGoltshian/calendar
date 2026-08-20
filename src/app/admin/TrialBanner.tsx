import Link from 'next/link';
import { t } from '@/i18n';

/**
 * באנר עליון עדין באזור הניהול בזמן תקופת הניסיון החינמית.
 * מציג את מספר הימים שנותרו וקישור עדין לעמוד השדרוג ובקשת הצעת המחיר.
 */
export default function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const b = t.billing.trialBanner;
  const text = b.text.replace('{days}', String(daysLeft));

  return (
    <div
      dir="rtl"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-[#E7D9B8] bg-[#FBF4E3] px-4 py-2 text-center text-sm text-[#6B5426]"
    >
      <span>{text}</span>
      <Link
        href="/admin/upgrade"
        className="font-bold text-[#82643C] underline-offset-2 hover:text-[#C59D5F] hover:underline"
      >
        {b.upgrade}
      </Link>
    </div>
  );
}
