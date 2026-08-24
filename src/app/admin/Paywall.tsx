import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { ContactBlock } from '@/components/billing/ContactBlock';
import { signOutOwner } from './billing-actions';
import UpgradeQuote from './upgrade/UpgradeQuote';

/**
 * מסך חסימה (paywall) לבעל העסק כשתוקף הניסיון/המנוי פג.
 * RTL, נייבי-זהב, עם טופס בקשת הצעת מחיר מוטמע (כדי שגם כשהניהול חסום אפשר לשדרג),
 * בלוק פרטי קשר והתנתקות נגישה.
 * עמוד ההזמנות הציבורי (/b/[slug]) אינו מושפע וממשיך לפעול ללקוחות.
 */
export default function Paywall() {
  const p = t.billing.paywall;

  return (
    <div
      dir="rtl"
      className="flex min-h-screen w-full items-center justify-center bg-[#241a15] p-6"
    >
      <div className="w-full max-w-xl rounded-3xl border border-[#2f241d] bg-[#1c1512] p-8 shadow-2xl">
        <p className="text-sm font-semibold text-[#C59D5F]">{BRAND.name}</p>

        <h1 className="mt-2 text-2xl font-extrabold text-[#F2D695]">
          {p.heading}
        </h1>

        <p className="mt-4 text-[#f3ece0]">{p.body}</p>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-inner">
          <UpgradeQuote variant="paywall" />
        </div>

        <div className="mt-6 rounded-2xl border border-[#2f241d] bg-[#241a15] p-5">
          <ContactBlock tone="dark" showHeading={false} />
        </div>

        <p className="mt-6 text-xs text-[#c9b79f]">{p.publicPageNote}</p>

        <form action={signOutOwner} className="mt-6">
          <button
            type="submit"
            className="text-sm font-medium text-[#c9b79f] underline-offset-2 transition hover:text-[#F2D695] hover:underline"
          >
            {p.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
