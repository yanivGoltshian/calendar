import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { requireClientSession } from '@/lib/auth';
import { getAppointmentsForUser } from '@/server/repos/account';
import { logout } from './actions';
import { CancelAppointmentButton } from './CancelAppointmentButton';
import { DeleteAccountSection } from './DeleteAccountSection';
import { btnGold, btnWhite, premiumCard } from './premium';
import { buildGoogleCalendarUrl } from '@/lib/calendar';
import { formatAgorot } from '@/lib/money';
import { formatDuration, formatDateString, formatLongDate, formatTime } from '@/lib/time';
import type { AppointmentStatus } from '@prisma/client';

export const metadata: Metadata = { title: t.account.title };

/** צבע ה-Badge לפי סטטוס — בגווני קרם/זהב/ורוד תואמי המותג. */
const STATUS_BADGE: Record<AppointmentStatus, string> = {
  PENDING: 'bg-[#f7efdc] text-[#8c6748] border-[#e6d6ac]',
  CONFIRMED: 'bg-[#e9f1e4] text-[#4f6a42] border-[#cfe0c3]',
  ARRIVED: 'bg-[#e6eef4] text-[#4a6478] border-[#cadbe6]',
  DONE: 'bg-[#f3ece0] text-[#6e655f] border-[#e2d6c3]',
  CANCELLED: 'bg-[#f7e7e3] text-[#a06c63] border-[#e6ccc5]',
  NO_SHOW: 'bg-[#f7e7e3] text-[#a06c63] border-[#e6ccc5]',
};

type Appointment = Awaited<ReturnType<typeof getAppointmentsForUser>>['upcoming'][number];

function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}

/** תפריט "הוספה ליומן" — details נטיבי (ללא JS), Google + ICS. */
function AddToCalendar({ googleUrl, icsHref }: { googleUrl: string; icsHref: string }) {
  const item =
    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#2c2522] transition hover:bg-[#f3ece0]';
  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-[#e7ddcd] bg-white px-4 py-2 text-sm font-bold text-[#8c6748] transition hover:bg-[#f3ece0] [&::-webkit-details-marker]:hidden">
        <CalendarGlyph />
        {t.account.addToCalendar}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-[#e7ddcd] bg-white p-1.5 shadow-[0_24px_50px_-24px_rgba(40,28,18,0.5)]">
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={item}>
          <CalendarGlyph />
          {t.account.addToGoogle}
        </a>
        <a href={icsHref} className={item}>
          <CalendarGlyph />
          {t.account.addToIcs}
        </a>
      </div>
    </details>
  );
}

function AppointmentCard({
  appt,
  showCalendar,
}: {
  appt: Appointment;
  showCalendar?: boolean;
}) {
  const tz = appt.business.timezone;
  const dateStr = formatDateString(appt.startAt, tz);
  const totalMinutes = appt.services.reduce((sum, s) => sum + s.durationMinSnapshot, 0);
  const serviceNames = appt.services.map((s) => s.nameSnapshot).join(', ');

  // ביטול אפשרי רק לתור ממתין/מאושר, וכל עוד לא נכנסנו לחלון הביטול של העסק.
  const windowHours = appt.business.settings?.cancellationWindowHours ?? 24;
  const cancellableStatus = appt.status === 'PENDING' || appt.status === 'CONFIRMED';
  const canCancel =
    cancellableStatus &&
    Date.now() < appt.startAt.getTime() - windowHours * 60 * 60 * 1000;

  // קישור "הוספה ליומן" — כותרת ותיאור זהים לקובץ ה-ICS שמפיק מסלול השרת.
  const calTitle = serviceNames
    ? `${serviceNames} · ${appt.business.name}`
    : appt.business.name;
  const calDetails = `${appt.business.name}\n${t.account.with} ${appt.staff.displayName}`;
  const googleUrl = buildGoogleCalendarUrl({
    id: appt.id,
    title: calTitle,
    start: appt.startAt,
    end: appt.endAt,
    details: calDetails,
    location: appt.business.address,
  });
  const icsHref = `/account/appointment/${appt.id}/ics`;

  return (
    <article className={`${premiumCard} flex flex-col gap-4 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold text-[#1b1715]">
            {serviceNames || appt.business.name}
          </p>
          <p className="mt-0.5 text-sm text-[#6e655f]">{appt.business.name}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${STATUS_BADGE[appt.status]}`}
        >
          {t.admin.statuses[appt.status]}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="text-[#6e655f]">{formatLongDate(dateStr, tz)}</dt>
          <dd className="font-semibold text-[#1b1715]">
            {t.account.at} {formatTime(appt.startAt, tz)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-[#6e655f]">{t.account.with}</dt>
          <dd className="font-semibold text-[#1b1715]">{appt.staff.displayName}</dd>
        </div>
        {totalMinutes > 0 ? (
          <div className="flex gap-1.5">
            <dt className="text-[#6e655f]">{t.account.duration}</dt>
            <dd className="font-semibold text-[#1b1715]">{formatDuration(totalMinutes)}</dd>
          </div>
        ) : null}
        <div className="flex gap-1.5">
          <dt className="text-[#6e655f]">{t.account.total}</dt>
          <dd className="font-extrabold text-[#8c6748]">
            {formatAgorot(appt.totalPriceAgorot)}
          </dd>
        </div>
      </dl>

      {showCalendar || canCancel ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#efe6d6] pt-4">
          {showCalendar ? <AddToCalendar googleUrl={googleUrl} icsHref={icsHref} /> : null}
          {canCancel ? <CancelAppointmentButton appointmentId={appt.id} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-extrabold tracking-tight text-[#1b1715]">{children}</h2>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[22px] border border-dashed border-[#e2d6c3] bg-white/60 px-4 py-8 text-center text-sm text-[#6e655f]">
      {children}
    </p>
  );
}

export default async function AccountPage() {
  const session = await requireClientSession();
  const { upcoming, past } = await getAppointmentsForUser({
    userId: session.userId,
    phone: session.phone,
    email: session.email,
  });

  const bookSlug = upcoming[0]?.business.slug ?? past[0]?.business.slug ?? null;
  const bookHref = bookSlug ? `/b/${bookSlug}` : '/';

  const detail = (label: string, value: string, ltr?: boolean) => (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#9a8f84]">
        {label}
      </dt>
      <dd className="font-semibold text-[#1b1715]" dir={ltr ? 'ltr' : undefined}>
        {value}
      </dd>
    </div>
  );

  return (
    <main dir="rtl" className="min-h-screen bg-[#faf6ef] px-4 pb-20 pt-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#c6a86a]">
              {BRAND.name}
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-[#1b1715]">
              {session.name ? `${t.account.greeting} ${session.name}` : t.account.title}
            </h1>
            <p className="mt-1 text-sm text-[#6e655f]">{t.account.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={bookHref} className={btnGold}>
              {t.account.bookCta}
            </a>
            <form action={logout}>
              <button type="submit" className={btnWhite}>
                {t.account.logout}
              </button>
            </form>
          </div>
        </header>

        <section className={premiumCard}>
          <h2 className="mb-4 text-base font-extrabold text-[#1b1715]">
            {t.account.detailsTitle}
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {detail(t.account.nameLabel, session.name || t.account.notProvided)}
            {detail(t.account.emailLabel, session.email || t.account.notProvided, true)}
            {detail(t.account.phoneLabel, session.phone || t.account.notProvided, true)}
          </dl>
        </section>

        <section className="flex flex-col gap-4">
          <SectionTitle>{t.account.upcomingTitle}</SectionTitle>
          {upcoming.length > 0 ? (
            upcoming.map((appt) => (
              <AppointmentCard key={appt.id} appt={appt} showCalendar />
            ))
          ) : (
            <EmptyState>{t.account.noUpcoming}</EmptyState>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <SectionTitle>{t.account.pastTitle}</SectionTitle>
          {past.length > 0 ? (
            past.map((appt) => <AppointmentCard key={appt.id} appt={appt} />)
          ) : (
            <EmptyState>{t.account.noPast}</EmptyState>
          )}
        </section>

        <DeleteAccountSection />
      </div>
    </main>
  );
}
