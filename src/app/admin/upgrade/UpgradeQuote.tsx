import { t } from '@/i18n';
import { getBusinessAccess } from '@/server/subscription';
import { bookingUrl } from '@/lib/booking-link';
import { getUpgradeContactDefaults } from '@/lib/upgradeAccess';
import { getAuthorizedUpgradeContext } from '@/server/upgradeAuthorization';
import UpgradeQuoteContent from './UpgradeQuoteContent';

/**
 * רכיב שרת משותף לאזור השדרוג (D4).
 *
 * מוצג בשני מקומות:
 *  - variant="page"    — עמוד /admin/upgrade המלא (כרטיסי חבילות + טופס).
 *  - variant="paywall" — מוטמע במסך ה-paywall, כדי שבעל עסק שתוקפו פג יוכל
 *                        לשלוח בקשת הצעת מחיר גם כשאזור הניהול חסום.
 *
 * הרכיב מביא בעצמו את ה-session והעסק, כדי שיהיה עצמאי בשני ההקשרים.
 */

type Variant = 'page' | 'paywall';

function pickDefaultPlan(searchParamPlan?: string): 'STANDARD' | 'PREMIUM' | 'EXCLUSIVE' {
  if (searchParamPlan === 'PREMIUM') return 'PREMIUM';
  if (searchParamPlan === 'EXCLUSIVE') return 'EXCLUSIVE';
  return 'STANDARD';
}

export default async function UpgradeQuote({
  variant = 'page',
  defaultPlan,
}: {
  variant?: Variant;
  defaultPlan?: string;
}) {
  const context = await getAuthorizedUpgradeContext();

  if (!context) return null;

  const { business } = context;
  const contact = getUpgradeContactDefaults(context);
  const defaults = {
    plan: pickDefaultPlan(defaultPlan),
    ...contact,
    publicPageUrl: bookingUrl(business.slug),
  };

  const access = getBusinessAccess({
    plan: business.plan,
    subscriptionStatus: business.subscriptionStatus,
    trialEndsAt: business.trialEndsAt,
    paidUntil: business.paidUntil,
  });

  const stateLine =
    access.state === 'active'
      ? t.quote.page.active
      : access.state === 'expired'
        ? t.quote.page.trialEnded
        : access.daysLeft <= 1
          ? t.quote.page.trialLastDay
          : t.quote.page.trialActive.replace('{days}', String(access.daysLeft));

  return (
    <UpgradeQuoteContent variant={variant} defaults={defaults} stateLine={stateLine} />
  );
}
