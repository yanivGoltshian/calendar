import type { Metadata } from 'next';
import { auth } from '@/auth';
import { t } from '@/i18n';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
import { bookingUrl } from '@/lib/booking-link';
import PublicQuoteForm, { type PublicQuoteDefaults } from './PublicQuoteForm';

export const metadata: Metadata = {
  title: t.quote.public.title,
  description: t.quote.public.subtitle,
};

export const dynamic = 'force-dynamic';

function pickDefaultPlan(searchParamPlan?: string): 'STANDARD' | 'PREMIUM' {
  const upper = searchParamPlan?.toUpperCase();
  return upper === 'PREMIUM' ? 'PREMIUM' : 'STANDARD';
}

/**
 * עמוד קבלת הצעת מחיר ציבורי (/quote) — נגיש לכולם ואינו תלוי באזור /admin.
 *
 * הבעיה שנפתרה: בעל עסק חוזר שהוא גם מנהל הפלטפורמה נותב בעבר ל-/admin/upgrade
 * ומשם הופנה מיד ל-/superadmin, כך שלטופס ההצעה מעולם לא הגיע. המסלול הציבורי
 * הזה עוקף לגמרי את השער של /admin, ומזהה בעצמו הקשר בעלים אם קיים.
 */
export default async function QuotePage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const defaultPlan = pickDefaultPlan(params.plan);

  const session = await auth();
  const sessionEmail = session?.user?.email ?? null;

  const ownedBusiness = sessionEmail
    ? (await getBusinessesOwnedByEmail(sessionEmail))[0] ?? null
    : null;
  const isOwner = Boolean(ownedBusiness);

  const defaults: PublicQuoteDefaults = ownedBusiness
    ? {
        mode: 'owner',
        plan: defaultPlan,
        name: session?.user?.name?.trim() || ownedBusiness.name,
        email: sessionEmail ?? '',
        phone: ownedBusiness.phone?.trim() || '',
        businessName: ownedBusiness.name,
        publicPageUrl: bookingUrl(ownedBusiness.slug),
      }
    : {
        mode: 'visitor',
        plan: defaultPlan,
        name: '',
        email: '',
        phone: '',
        businessName: '',
        publicPageUrl: '',
      };

  return (
    <main dir="rtl" className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6 text-right">
        <h1 className="text-2xl font-extrabold text-[#0A182D]">{t.quote.public.title}</h1>
        <p className="mt-2 text-slate-600">{t.quote.public.subtitle}</p>
        <p className="mt-3 rounded-lg border border-[#E7D9B8] bg-[#FBF7EC] px-4 py-2 text-sm text-[#6B5426]">
          {isOwner ? t.quote.public.ownerNote : t.quote.public.visitorNote}
        </p>
      </header>

      <PublicQuoteForm defaults={defaults} />
    </main>
  );
}
