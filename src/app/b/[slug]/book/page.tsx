import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBusinessBySlug } from '@/server/repos/business';
import { t } from '@/i18n';
import BookingStepper from './BookingStepper';

type Props = { params: Promise<{ slug: string }>; searchParams?: Promise<{ service?: string; staff?: string }> };

export const metadata: Metadata = { title: t.booking.title };

export default async function BookPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  // מעבירים לרכיב הלקוח רק את השדות הדרושים לזרימת ההזמנה.
  const services = business.services.map((s) => ({
    id: s.id,
    name: s.name,
    durationMin: s.durationMin,
    priceAgorot: s.priceAgorot,
    hidePrice: s.hidePrice,
    hideDuration: s.hideDuration,
  }));

  const staff = business.staff.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    title: m.title,
  }));

  // קישור עמוק משירות: אם הגיעו עם ?service=<id> תקין, מסמנים אותו מראש ומדלגים על שלב השירותים.
  // ?staff=<id> תקין (למשל מ"קביעת תור חוזר") מסמן גם את איש הצוות ומדלג גם על שלב הצוות.
  const sp = (await searchParams) ?? {};
  const preselectedServiceId = services.find((s) => s.id === sp.service)?.id ?? null;
  const preselectedStaffId = staff.find((m) => m.id === sp.staff)?.id ?? null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <BookingStepper
        slug={business.slug}
        businessName={business.name}
        services={services}
        staff={staff}
        preselectedServiceId={preselectedServiceId}
        preselectedStaffId={preselectedStaffId}
        plan={business.plan === 'premium' ? 'premium' : 'basic'}
        requirePhoneVerification={business.settings?.requirePhoneVerification ?? false}
        allowBookingWithoutPhone={business.settings?.allowBookingWithoutPhone ?? false}
        requireEmail={business.settings?.requireEmail ?? true}
      />
    </main>
  );
}
