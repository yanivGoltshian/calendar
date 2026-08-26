import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getEntryByClaimToken } from '@/server/repos/waitlist';
import { getAppointmentById } from '@/server/repos/appointments';
import { DEFAULT_TZ, formatDateString, formatLongDate, formatTime } from '@/lib/time';
import { Card, CardBody, Button } from '@/components/ui/admin';
import { Mascot } from '@/components/brand/Mascot';
import { ClaimActions } from './ClaimActions';

// קישור תפיסה פרטי — לא לאינדוקס, ותמיד טרי (נקרא מה-DB לפי טוקן).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: t.waitlist.claim.metaTitle,
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/** מעטפת עמוד אחידה בפלטת נייבי-זהב, RTL. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main dir="rtl" className="min-h-screen bg-[#0B1526] px-4 pb-16 pt-10">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="text-center">
          <p className="text-sm font-semibold text-[#F2D695]">{BRAND.name}</p>
          <h1 className="mt-1 text-2xl font-bold text-[#E8ECF3]">
            {t.waitlist.claim.heading}
          </h1>
        </header>
        {children}
      </div>
    </main>
  );
}

/** כרטיס מצב פשוט (כותרת + גוף), עם קישור חזרה לעמוד העסק כאשר ידוע ה-slug. */
function StateCard({
  title,
  body,
  slug,
}: {
  title: string;
  body: string;
  slug?: string | null;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-3 text-center">
        <p className="text-lg font-semibold text-[#E8ECF3]">{title}</p>
        <p className="text-sm text-[#9AA7BD]">{body}</p>
        {slug ? (
          <a href={`/b/${slug}`} className="mt-1">
            <Button variant="secondary" size="md" className="w-full">
              {t.waitlist.claim.backToBusiness}
            </Button>
          </a>
        ) : null}
      </CardBody>
    </Card>
  );
}

export default async function ClaimPage({ params }: Props) {
  const { token } = await params;
  const entry = await getEntryByClaimToken(token);

  // טוקן לא תקין או רשומה שנמחקה.
  if (!entry) {
    return (
      <Shell>
        <StateCard
          title={t.waitlist.claim.notFoundTitle}
          body={t.waitlist.claim.notFoundBody}
        />
      </Shell>
    );
  }

  const slug = entry.business.slug;

  // כבר נתפס (BOOKED) — מישהו הקדים, או שהלקוח עצמו כבר תפס.
  if (entry.status === 'BOOKED') {
    return (
      <Shell>
        <StateCard
          title={t.waitlist.claim.takenTitle}
          body={t.waitlist.claim.takenBody}
          slug={slug}
        />
      </Shell>
    );
  }

  // ההצעה אינה פעילה (פגה/בוטלה) או שההחזקה כבר אינה בתוקף.
  const now = Date.now();
  const holdActive =
    entry.status === 'NOTIFIED' &&
    !!entry.holdExpiresAt &&
    entry.holdExpiresAt.getTime() > now;
  if (!holdActive) {
    return (
      <Shell>
        <StateCard
          title={t.waitlist.claim.expiredTitle}
          body={t.waitlist.claim.expiredBody}
          slug={slug}
        />
      </Shell>
    );
  }

  // המשבצת בפועל נמצאת על התור שבוטל (heldAppointmentId). בלעדיו אין מה לתפוס.
  const appt = entry.heldAppointmentId
    ? await getAppointmentById(entry.heldAppointmentId)
    : null;
  if (!appt) {
    return (
      <Shell>
        <StateCard
          title={t.waitlist.claim.expiredTitle}
          body={t.waitlist.claim.expiredBody}
          slug={slug}
        />
      </Shell>
    );
  }

  const tz = entry.business.timezone ?? DEFAULT_TZ;
  const dateStr = formatDateString(appt.startAt, tz);
  const date = formatLongDate(dateStr, tz);
  const time = formatTime(appt.startAt, tz);
  const services = appt.services
    .map((s) => s.nameSnapshot)
    .filter(Boolean)
    .join(', ');
  const holdTime = formatTime(entry.holdExpiresAt as Date, tz);

  const rows: Array<{ label: string; value: string }> = [
    { label: t.waitlist.claim.whenLabel, value: `${date}, ${time}` },
    { label: t.waitlist.claim.staffLabel, value: appt.staff.displayName },
  ];
  if (services) {
    rows.push({ label: t.waitlist.claim.serviceLabel, value: services });
  }

  return (
    <Shell>
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="text-center">
            <Mascot
              pose="wink"
              circle
              size={56}
              alt={BRAND.name}
              className="mx-auto mb-2 ring-2 ring-[#16233A]"
            />
            <p className="text-sm text-[#9AA7BD]">{t.waitlist.claim.subheading}</p>
          </div>

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

          <p className="rounded-xl border border-[#16233A] bg-[#08101C] px-4 py-3 text-center text-sm text-[#F2D695]">
            {t.waitlist.claim.holdNotice.replace('{time}', holdTime)}
          </p>

          <ClaimActions token={token} slug={slug} />
        </CardBody>
      </Card>
    </Shell>
  );
}
