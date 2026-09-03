import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAllBusinessSlugs, getBusinessBySlug } from '@/server/repos/business';
import { t } from '@/i18n';
import { authProviderStatus } from '@/auth';
import BookingStepper from './BookingStepper';

type Props = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = { title: t.booking.title };

// עמוד סטטי לחלוטין: שלד אשף ההזמנה נשמר במטמון ללא תפוגה ומתרענן רק על פי דרישה
// דרך revalidatePath בפעולות הבעלים. בדיקת המנוי (עסק שפג תוקפו) הוסרה מהשרת ועברה
// לקריאת הזמינות בצד הלקוח, כך שאין נתון תלוי-זמן ב-HTML הנשמר. פרטי הלקוח למילוי
// מוקדם וקישורים עמוקים (service/staff/date/time) נטענים בצד הלקוח, כך שהשלד ללא PII.
export const revalidate = false;
export const dynamicParams = true;

// טרום-רינדור של הסלאגים הידועים מה-DB לטובת סורקים; נופל ל-[] בבנייה ללא DB
// (סלאגים חדשים מתרנדרים בפנייה הראשונה ואז נשמרים במטמון).
export async function generateStaticParams() {
  try {
    const businesses = await getAllBusinessSlugs();
    return businesses.map((b) => ({ slug: b.slug }));
  } catch {
    return [];
  }
}

export default async function BookPage({ params }: Props) {
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

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <Suspense fallback={null}>
        <BookingStepper
          slug={business.slug}
          businessName={business.name}
          phone={business.phone}
          services={services}
          staff={staff}
          plan={business.plan}
          googleEnabled={authProviderStatus.google}
          waitlistEnabled={business.settings?.waitlistEnabled ?? true}
        />
      </Suspense>
    </main>
  );
}
