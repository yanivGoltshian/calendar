import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getAppointmentByConfirmToken } from '@/server/repos/appointments';
import { DEFAULT_TZ, formatDateString, formatLongDate, formatTime } from '@/lib/time';
import { Card, CardBody } from '@/components/ui/admin';
import { ConfirmActions } from './ConfirmActions';

// קישור אישור פרטי — לא לאינדוקס, ותמיד טרי (נקרא מה-DB לפי טוקן).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: t.reminders.confirm.title,
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

type Appointment = NonNullable<
  Awaited<ReturnType<typeof getAppointmentByConfirmToken>>
>;

/** מעטפת עמוד אחידה בפלטת נייבי-זהב, RTL. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main dir="rtl" className="min-h-screen bg-[#0B1526] px-4 pb-16 pt-10">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="text-center">
          <p className="text-sm font-semibold text-[#F2D695]">{BRAND.name}</p>
          <h1 className="mt-1 text-2xl font-bold text-[#E8ECF3]">
            {t.reminders.confirm.title}
          </h1>
        </header>
        {children}
      </div>
    </main>
  );
}

/** כרטיס מצב פשוט (כותרת + גוף) למצבים ללא כפתורים. */
function StateCard({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-2 text-center">
        <p className="text-lg font-semibold text-[#E8ECF3]">{title}</p>
        <p className="text-sm text-[#9AA7BD]">{body}</p>
      </CardBody>
    </Card>
  );
}

/** בלוק פרטי התור: עסק, תאריך, שעה, איש צוות ושירותים. */
function Details({ appt }: { appt: Appointment }) {
  const tz = appt.business.timezone ?? DEFAULT_TZ;
  const dateStr = formatDateString(appt.startAt, tz);
  const date = formatLongDate(dateStr, tz);
  const time = formatTime(appt.startAt, tz);
  const services = appt.services.map((s) => s.nameSnapshot).filter(Boolean).join(', ');

  const rows: Array<{ label: string; value: string }> = [
    { label: t.reminders.confirm.businessLabel, value: appt.business.name },
    { label: t.reminders.confirm.dateLabel, value: date },
    { label: t.reminders.confirm.timeLabel, value: time },
    { label: t.reminders.confirm.staffLabel, value: appt.staff.displayName },
  ];
  if (services) {
    rows.push({ label: t.reminders.confirm.serviceLabel, value: services });
  }

  return (
    <dl className="flex flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-3 border-b border-[#16233A] pb-2 last:border-0 last:pb-0"
        >
          <dt className="text-sm text-[#9AA7BD]">{row.label}</dt>
          <dd className="text-sm font-semibold text-[#E8ECF3]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ConfirmPage({ params }: Props) {
  const { token } = await params;
  const appt = await getAppointmentByConfirmToken(token);

  // טוקן לא תקין או תור שנמחק.
  if (!appt) {
    return (
      <Shell>
        <StateCard
          title={t.reminders.confirm.notFoundTitle}
          body={t.reminders.confirm.notFoundBody}
        />
      </Shell>
    );
  }

  // תור שאינו פעיל עוד (בוטל/הברזה/הושלם/הגיע) — אין מה לאשר.
  const active = appt.status === 'PENDING' || appt.status === 'CONFIRMED';
  if (!active) {
    return (
      <Shell>
        <StateCard
          title={t.reminders.confirm.cancelledTitle}
          body={t.reminders.confirm.cancelledBody}
        />
      </Shell>
    );
  }

  // כבר אושר או כבר נדחה בעבר — מציגים פרטים והודעת מצב, בלי כפתורים.
  if (appt.confirmationStatus === 'CONFIRMED' || appt.confirmationStatus === 'DECLINED') {
    const confirmed = appt.confirmationStatus === 'CONFIRMED';
    return (
      <Shell>
        <Card>
          <CardBody className="flex flex-col gap-4">
            <Details appt={appt} />
            <div className="rounded-xl border border-[#16233A] bg-[#08101C] px-4 py-3 text-center">
              <p className="text-base font-semibold text-[#E8ECF3]">
                {confirmed
                  ? t.reminders.confirm.alreadyConfirmedTitle
                  : t.reminders.confirm.alreadyDeclinedTitle}
              </p>
              <p className="mt-1 text-sm text-[#9AA7BD]">
                {confirmed
                  ? t.reminders.confirm.alreadyConfirmedBody
                  : t.reminders.confirm.alreadyDeclinedBody}
              </p>
            </div>
          </CardBody>
        </Card>
      </Shell>
    );
  }

  // מצב רגיל: ממתין לאישור — פרטים + כפתורי אישור/ביטול.
  return (
    <Shell>
      <Card>
        <CardBody className="flex flex-col gap-4">
          <p className="text-center text-sm text-[#9AA7BD]">
            {t.reminders.confirm.intro}
          </p>
          <Details appt={appt} />
          <ConfirmActions token={token} />
        </CardBody>
      </Card>
    </Shell>
  );
}
