import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { ContactBlock } from '@/components/billing/ContactBlock';
import { signOutOwner } from './billing-actions';

/**
 * מסך חסימה (paywall) לבעל העסק כשתוקף הניסיון/המנוי פג.
 * RTL, נייבי-זהב, עם בלוק פרטי קשר לשדרוג והתנתקות נגישה.
 * עמוד ההזמנות הציבורי (/b/[slug]) אינו מושפע וממשיך לפעול ללקוחות.
 */
export default function Paywall() {
  const p = t.billing.paywall;

  return (
    <div
      dir="rtl"
      className="flex min-h-screen w-full items-center justify-center bg-[#0B1526] p-6"
    >
      <div className="w-full max-w-lg rounded-3xl border border-[#16233A] bg-[#0E1B2E] p-8 shadow-2xl">
        <p className="text-sm font-semibold text-[#C59D5F]">{BRAND.name}</p>

        <h1 className="mt-2 text-2xl font-extrabold text-[#F2D695]">
          {p.heading}
        </h1>

        <p className="mt-4 text-[#E8ECF3]">{p.body}</p>

        <div className="mt-6 rounded-2xl border border-[#16233A] bg-[#0B1526] p-5">
          <ContactBlock tone="dark" showHeading={false} />
        </div>

        <p className="mt-6 text-xs text-[#9AA7BD]">{p.publicPageNote}</p>

        <form action={signOutOwner} className="mt-6">
          <button
            type="submit"
            className="text-sm font-medium text-[#9AA7BD] underline-offset-2 transition hover:text-[#F2D695] hover:underline"
          >
            {p.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
