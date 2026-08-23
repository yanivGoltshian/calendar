import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { requireClientSession } from '@/lib/auth';
import { getAppointmentsForUser } from '@/server/repos/account';
import { logout } from './actions';
import { CancelAppointmentButton } from './CancelAppointmentButton';
import { DeleteAccountSection } from './DeleteAccountSection';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from '@/components/ui/admin';
import { formatAgorot } from '@/lib/money';
import { formatDuration, formatDateString, formatLongDate, formatTime } from '@/lib/time';
import type { AppointmentStatus } from '@prisma/client';

export const metadata: Metadata = { title: t.account.title };

const STATUS_TONE: Record<
  AppointmentStatus,
  'neutral' | 'gold' | 'success' | 'warning' | 'danger' | 'info'
> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  ARRIVED: 'info',
  DONE: 'neutral',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

type Appointment = Awaited<ReturnType<typeof getAppointmentsForUser>>['upcoming'][number];

function AppointmentCard({ appt }: { appt: Appointment }) {
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

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[#E8ECF3]">
              {serviceNames || appt.business.name}
            </p>
            <p className="mt-0.5 text-sm text-[#9AA7BD]">{appt.business.name}</p>
          </div>
          <Badge tone={STATUS_TONE[appt.status]}>{t.admin.statuses[appt.status]}</Badge>
        </div>

        <dl className="grid grid-cols-1 gap-1.5 text-sm text-[#C7D0E0] sm:grid-cols-2">
          <div className="flex gap-1.5">
            <dt className="text-[#9AA7BD]">{formatLongDate(dateStr, tz)}</dt>
            <dd className="font-medium text-[#E8ECF3]">
              {t.account.at} {formatTime(appt.startAt, tz)}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-[#9AA7BD]">{t.account.with}</dt>
            <dd className="font-medium text-[#E8ECF3]">{appt.staff.displayName}</dd>
          </div>
          {totalMinutes > 0 ? (
            <div className="flex gap-1.5">
              <dt className="text-[#9AA7BD]">משך</dt>
              <dd className="font-medium text-[#E8ECF3]">{formatDuration(totalMinutes)}</dd>
            </div>
          ) : null}
          <div className="flex gap-1.5">
            <dt className="text-[#9AA7BD]">{t.account.total}</dt>
            <dd className="font-semibold text-[#F2D695]">
              {formatAgorot(appt.totalPriceAgorot)}
            </dd>
          </div>
        </dl>

        {canCancel ? (
          <div className="border-t border-[#16233A] pt-3">
            <CancelAppointmentButton appointmentId={appt.id} />
          </div>
        ) : null}
      </CardBody>
    </Card>
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

  return (
    <main dir="rtl" className="min-h-screen bg-[#0B1526] px-4 pb-16 pt-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#F2D695]">{BRAND.name}</p>
            <h1 className="mt-1 text-2xl font-bold text-[#E8ECF3]">{t.account.title}</h1>
            <p className="mt-1 text-sm text-[#9AA7BD]">
              {session.name ? `${session.name} · ` : ''}
              {t.account.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button href={bookHref} variant="primary" size="sm">
              {t.account.bookCta}
            </Button>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                {t.account.logout}
              </Button>
            </form>
          </div>
        </header>

        <section className="flex flex-col gap-3 rounded-2xl border border-[#16233A] bg-[#08101C] p-4">
          <h2 className="text-base font-bold text-[#E8ECF3]">{t.account.detailsTitle}</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-[#9AA7BD]">{t.account.nameLabel}</dt>
              <dd className="font-medium text-[#E8ECF3]">
                {session.name || t.account.notProvided}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[#9AA7BD]">{t.account.emailLabel}</dt>
              <dd className="font-medium text-[#E8ECF3]" dir="ltr">
                {session.email || t.account.notProvided}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-[#9AA7BD]">{t.account.phoneLabel}</dt>
              <dd className="font-medium text-[#E8ECF3]" dir="ltr">
                {session.phone || t.account.notProvided}
              </dd>
            </div>
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <CardHeader className="px-0">
            <CardTitle className="text-[#E8ECF3]">{t.account.upcomingTitle}</CardTitle>
          </CardHeader>
          {upcoming.length > 0 ? (
            upcoming.map((appt) => <AppointmentCard key={appt.id} appt={appt} />)
          ) : (
            <p className="rounded-xl border border-[#16233A] bg-[#08101C] px-4 py-6 text-center text-sm text-[#9AA7BD]">
              {t.account.noUpcoming}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <CardHeader className="px-0">
            <CardTitle className="text-[#E8ECF3]">{t.account.pastTitle}</CardTitle>
          </CardHeader>
          {past.length > 0 ? (
            past.map((appt) => <AppointmentCard key={appt.id} appt={appt} />)
          ) : (
            <p className="rounded-xl border border-[#16233A] bg-[#08101C] px-4 py-6 text-center text-sm text-[#9AA7BD]">
              {t.account.noPast}
            </p>
          )}
        </section>

        <DeleteAccountSection />
      </div>
    </main>
  );
}
