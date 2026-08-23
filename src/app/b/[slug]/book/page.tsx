import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getBusinessBySlug } from '@/server/repos/business';
import { t } from '@/i18n';
import { getClientSession } from '@/lib/session';
import { authProviderStatus } from '@/auth';
import { todayDateString } from '@/lib/time';
import { canAcceptPublicBookings } from '@/server/subscription';
import BookingStepper from './BookingStepper';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ service?: string; staffId?: string; date?: string; time?: string }>;
};

export const metadata: Metadata = { title: t.booking.title };

export default async function BookPage({ params, searchParams }: Props) {
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

  // קישור עמוק מהווידג'ט: מסמנים מראש שירות, איש צוות, תאריך ושעה תקינים; האשף יקפוץ לסיכום כשכולם תקפים.
  const sp = (await searchParams) ?? {};
  const preselectedServiceId = services.find((s) => s.id === sp.service)?.id ?? null;
  const preselectedStaffId = staff.find((m) => m.id === sp.staffId)?.id ?? null;
  const today = todayDateString();
  const preselectedDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date >= today ? sp.date : null;
  const preselectedTime = sp.time && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : null;

  // לקוח מחובר: מעבירים פרטי קשר למילוי מוקדם ולהסתרת שדה המייל (#2). כניסת גוגל זמינה בכל המסלולים (#1).
  const clientSession = await getClientSession();
  const customer = clientSession
    ? {
        name: clientSession.name ?? '',
        phone: clientSession.phone ?? '',
        email: clientSession.email ?? '',
      }
    : null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <BookingStepper
        slug={business.slug}
        businessName={business.name}
        services={services}
        staff={staff}
        preselectedServiceId={preselectedServiceId}
        preselectedStaffId={preselectedStaffId}
        preselectedDate={preselectedDate}
        preselectedTime={preselectedTime}
        plan={business.plan}
        customer={customer}
        googleEnabled={authProviderStatus.google}
      />
    </main>
  );
}
