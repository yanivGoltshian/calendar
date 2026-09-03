import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getBusinessBySlug } from '@/server/repos/business';
import { t } from '@/i18n';
import { authProviderStatus } from '@/auth';
import { canAcceptPublicBookings } from '@/server/subscription';
import BookingStepper from './BookingStepper';

type Props = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = { title: t.booking.title };

// ISR: שלד אשף ההזמנה נשמר במטמון ומתרענן כל 600 שניות (וגם מיידית דרך
// revalidatePath בפעולות הניהול). פרטי הלקוח למילוי מוקדם וקישורים עמוקים
// (service/staff/date/time) נטענים בצד הלקוח, כך שה-HTML הנשמר במטמון ללא PII.
export const revalidate = 600;

// יצירת עמודים לפי slug על פי דרישה (ISR) במקום רשימה סטטית מראש.
export function generateStaticParams() {
  return [];
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug);
  if (!business) notFound();

  // אכיפת מנוי בצד השרת: עסק שפג תוקף הניסיון/המנוי שלו אינו מקבל הזמנות דרך העמוד
  // הציבורי. כל כפתורי "קבעו תור" בעמוד הנחיתה מובילים לכאן, ולכן גייט יחיד זה חוסם
  // את כל מסלולי הכניסה ומציג הודעה ניטרלית ללקוח במקום אשף ההזמנה.
  if (!canAcceptPublicBookings(business)) {
    const copy = t.publicPage.unavailable;
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 py-10 text-center">
        <h1 className="text-xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{copy.body}</p>
        <div className="mt-6 flex w-full flex-col gap-2">
          {business.phone ? (
            <a
              href={`tel:${business.phone}`}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {copy.callCta}
            </a>
          ) : null}
          <Link
            href={`/b/${business.slug}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {copy.back}
          </Link>
        </div>
      </main>
    );
  }

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
