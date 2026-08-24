import { auth } from '@/auth';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { getBusinessAccess } from '@/server/subscription';
import { bookingUrl } from '@/lib/booking-link';
import QuoteRequestForm, { type QuoteFormDefaults } from './QuoteRequestForm';

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

function pickDefaultPlan(
  searchParamPlan?: string,
): 'STANDARD' | 'PREMIUM' | 'EXCLUSIVE' {
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
  const session = await auth();
  const business = await getActiveBusiness();

  if (!business || !session?.user?.email || business.ownerEmail !== session.user.email) {
    // מחוץ להקשר בעלים תקין לא מציגים טופס. במסך ה-paywall יש ממילא בלוק קשר.
    return null;
  }

  const defaults: QuoteFormDefaults = {
    plan: pickDefaultPlan(defaultPlan),
    name: session.user.name?.trim() || business.name,
    email: session.user.email,
    phone: business.phone?.trim() || '',
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

  const dark = variant === 'paywall';

  return (
    <section dir="rtl" className={dark ? 'text-right' : 'text-right'}>
      {!dark ? (
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#1c1512]">{t.quote.page.title}</h1>
          <p className="mt-2 text-[#6e655f]">{t.quote.page.subtitle}</p>
        </header>
      ) : (
        <h2 className="mb-2 text-xl font-extrabold text-[#1c1512]">{t.quote.form.heading}</h2>
      )}

      <p
        className={
          dark
            ? 'mb-5 rounded-lg bg-[#FBF7EC] px-4 py-2 text-sm text-[#6B5426]'
            : 'mb-6 rounded-lg border border-[#E7D9B8] bg-[#FBF7EC] px-4 py-2 text-sm text-[#6B5426]'
        }
      >
        {stateLine}
      </p>

      {!dark ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {(['standard', 'premium', 'exclusive'] as const).map((key) => {
            const plan = (
              t.quote.plans as unknown as Record<
                string,
                { name: string; tagline: string; features: string[] }
              >
            )[key];
            if (!plan) return null;
            return (
              <div
                key={key}
                className="rounded-2xl border border-[#e7ddcd] bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-[#1c1512]">{plan.name}</h3>
                  <span className="rounded-full bg-[#1c1512] px-3 py-1 text-xs font-semibold text-[#F2D695]">
                    {t.quote.plans.contactTag}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#6e655f]">{plan.tagline}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-[#4a4038]">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex gap-2">
                      <span className="text-[#C59D5F]">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mb-4">
        <p className="text-sm text-[#6e655f]">{t.quote.form.intro}</p>
      </div>

      <QuoteRequestForm defaults={defaults} />
    </section>
  );
}
