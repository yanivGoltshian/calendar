import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { listStaff, ensureOwnerStaffMember } from '@/server/repos/staff';
import { listServices } from '@/server/repos/services';
import { getBusinessHours } from '@/server/repos/workingHours';
import { getAppointmentsForBusinessRange, countPendingAppointments } from '@/server/repos/appointments';
import {
  todayDateString,
  addDaysToDateString,
  formatLongDate,
  formatTime,
  formatDateString,
  localWallTimeToUtc,
  utcToLocalParts,
  weekdayForDateString,
} from '@/lib/time';
import { displayPhone } from '@/lib/crypto';
import { hashToIndex } from './serviceColors';
import CalendarBoard from './CalendarBoard';
import OnboardingChecklist, { type ChecklistItem } from './OnboardingChecklist';
import { isOnboardingChecklistDismissed } from './onboarding/checklistState';
import ShareBanner from './ShareBanner';
import GoLivePanel from './GoLivePanel';
import { bookingUrl, bookingPath, isBusinessLive } from '@/lib/booking-link';
import { bookingQrSvg } from '@/lib/qr-svg';
import type {
  ApptBlock,
  CalendarColumn,
  CalendarView,
  ServiceOption,
  StaffOption,
} from './calendar-types';

export const metadata: Metadata = { title: t.admin.calendarTitle };

type Props = {
  searchParams: Promise<{ date?: string; staffId?: string; view?: string }>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_START = 8 * 60; // 08:00
const DEFAULT_END = 20 * 60; // 20:00

function midnightUtc(dateStr: string, tz: string): Date {
  return localWallTimeToUtc(
    Number(dateStr.slice(0, 4)),
    Number(dateStr.slice(5, 7)),
    Number(dateStr.slice(8, 10)),
    0,
    tz,
  );
}

function dayMonthLabel(dateStr: string): string {
  return `${Number(dateStr.slice(8, 10))}.${Number(dateStr.slice(5, 7))}`;
}

export default async function AdminCalendarPage({ searchParams }: Props) {
  const sp = await searchParams;
  const business = await getActiveBusiness();
  if (!business) notFound();

  const tz = business.timezone;
  const cal = t.admin.calendar;
  let staffRows = await listStaff(business.id);
  // ריפוי־עצמי לעסקים קיימים ללא צוות: הבאג המקורי השאיר עסקים עם אפס אנשי צוות, ולכן
  // הבעלים רואה יומן ריק בלי דרך לפעול. getActiveBusiness כבר מסונן לעסק הפעיל של הבעלים
  // המאומת בלבד — ולכן זה בטוח ומוגבל לבעלים. אידמפוטנטי: רץ רק כשאין צוות. עמיד לתקלות.
  if (staffRows.length === 0 && business.ownerEmail) {
    try {
      await ensureOwnerStaffMember(business.id, {
        ownerEmail: business.ownerEmail,
        businessName: business.name,
      });
      staffRows = await listStaff(business.id);
    } catch {
      // זריעת איש הצוות הדיפולטי נכשלה; העמוד ממשיך להיטען עם מצב ריק (כולל כפתור הוספה).
    }
  }
  const serviceRows = await listServices(business.id);

  const view: CalendarView = sp.view === 'week' ? 'week' : 'day';
  const date =
    sp.date && DATE_RE.test(sp.date) ? sp.date : todayDateString(tz);
  const today = todayDateString(tz);

  const activeStaff =
    staffRows.find((s) => s.id === sp.staffId) ?? staffRows[0] ?? null;
  const activeStaffId = activeStaff?.id ?? '';

  // מיפוי שירות → אינדקס צבע (לפי סדר המיון), + אפשרויות שירות לטופס ולמקרא.
  const colorByServiceId = new Map<string, number>();
  serviceRows.forEach((s, i) => colorByServiceId.set(s.id, i));
  const services: ServiceOption[] = serviceRows.map((s, i) => ({
    id: s.id,
    name: s.name,
    durationMin: s.durationMin,
    priceAgorot: s.priceAgorot,
    colorIndex: i,
  }));
  const staff: StaffOption[] = staffRows.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    title: s.title ?? '',
  }));

  // טווח הזמן לשליפה + מבנה העמודות.
  let fromUtc: Date;
  let toUtc: Date;
  let weekStart = date;
  let columns: CalendarColumn[] = [];
  let headerLabel = '';

  if (view === 'week') {
    const weekday = weekdayForDateString(date, tz); // 0=ראשון
    weekStart = addDaysToDateString(date, -weekday);
    const weekEnd = addDaysToDateString(weekStart, 6);
    const weekDates = Array.from({ length: 7 }, (_, i) =>
      addDaysToDateString(weekStart, i),
    );
    fromUtc = midnightUtc(weekStart, tz);
    toUtc = midnightUtc(addDaysToDateString(weekStart, 7), tz);
    headerLabel = `${dayMonthLabel(weekStart)} – ${dayMonthLabel(weekEnd)}`;
    columns = activeStaff
      ? weekDates.map((d, i) => ({
          key: d,
          title: cal.weekdaysLong[i],
          subtitle: dayMonthLabel(d),
          staffId: activeStaff.id,
          date: d,
          isToday: d === today,
        }))
      : [];
  } else {
    fromUtc = midnightUtc(date, tz);
    toUtc = midnightUtc(addDaysToDateString(date, 1), tz);
    headerLabel = formatLongDate(date, tz);
    columns = staffRows.map((s) => ({
      key: s.id,
      title: s.displayName,
      subtitle: s.title ?? '',
      staffId: s.id,
      date,
      isToday: date === today,
    }));
  }

  const rows = staffRows.length
    ? await getAppointmentsForBusinessRange(business.id, fromUtc, toUtc)
    : [];

  // הכנת בלוקים לרינדור + חישוב חלון הגריד.
  let minStart = DEFAULT_START;
  let maxEnd = DEFAULT_END;
  const appts: ApptBlock[] = [];

  for (const a of rows) {
    if (view === 'week' && a.staffId !== activeStaffId) continue;
    if (view === 'day' && !columns.some((c) => c.staffId === a.staffId)) {
      continue;
    }
    const parts = utcToLocalParts(a.startAt, tz);
    const startMinute = parts.minutes;
    const durationMin = Math.max(
      1,
      Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60_000),
    );
    const localDate = formatDateString(a.startAt, tz);
    const serviceNames = a.services.map((s) => s.nameSnapshot).join(' + ');
    const firstServiceId = a.services[0]?.serviceId;
    const colorIndex =
      (firstServiceId ? colorByServiceId.get(firstServiceId) : undefined) ??
      hashToIndex(serviceNames || a.id);

    minStart = Math.min(minStart, startMinute);
    maxEnd = Math.max(maxEnd, startMinute + durationMin);

    appts.push({
      id: a.id,
      columnKey: view === 'week' ? localDate : a.staffId,
      startMinute,
      durationMin,
      status: a.status,
      clientId: a.client?.id ?? '',
      clientName: a.client?.name ?? '',
      clientPhone: a.client?.phone ? displayPhone(a.client.phone) : '',
      clientEmail: a.client?.email ?? '',
      serviceNames,
      colorIndex,
      priceAgorot: a.totalPriceAgorot,
      startLabel: formatTime(a.startAt, tz),
      endLabel: formatTime(a.endAt, tz),
    });
  }

  const gridStartMinute = Math.max(0, Math.floor(minStart / 60) * 60);
  const gridEndMinute = Math.min(1440, Math.ceil(maxEnd / 60) * 60);
  const granularity = business.settings?.slotGranularityMinutes ?? 15;
  const defaultDurationMin = serviceRows[0]?.durationMin ?? 30;

  // רשימת ההמשך המודרכת של ההקמה: מחשבים בצד השרת אילו אזורים נדרשים כבר הוגדרו,
  // כדי שהרשימה תהיה ניתנת להמשך מכל מכשיר. כל צעד ניתן לדילוג והשלמה מאוחרת.
  // הרשימה מוצגת רק כשנותר צעד פתוח והבעלים לא בחר להסתירה.
  const businessHours = await getBusinessHours(business.id);
  const pendingCount = await countPendingAppointments(business.id);
  const checklistDismissed = await isOnboardingChecklistDismissed();
  const checklistItems: ChecklistItem[] = [
    { key: 'services', done: serviceRows.length > 0, href: '/admin/services' },
    { key: 'staff', done: staffRows.length > 0, href: '/admin/team' },
    {
      key: 'workingHours',
      done: businessHours.length > 0,
      href: '/admin/working-hours',
    },
    {
      key: 'branding',
      done: Boolean(
        business.logoUrl || business.brandColor || business.coverImageUrl,
      ),
      href: '/admin/settings',
    },
    {
      key: 'details',
      done: business.settings?.onboardingCompleted === true,
      href: '/admin/onboarding',
    },
  ];
  const showChecklist =
    !checklistDismissed && checklistItems.some((i) => !i.done);

  // אותות "העסק חי" ו"כל הצעדים הושלמו" נגזרים מאותם נתונים של רשימת ההקמה.
  // הקישור וקוד ה-QR נבנים בשרת ומועברים לרכיבי הלקוח, כדי לא לטעון ספריית QR בדפדפן.
  const isLive = isBusinessLive({
    serviceCount: serviceRows.length,
    workingHoursCount: businessHours.length,
  });
  const allStepsComplete = checklistItems.every((i) => i.done);
  const bookingLink = bookingUrl(business.slug);
  const bookingPagePath = bookingPath(business.slug);
  const bookingQr = isLive
    ? bookingQrSvg(bookingLink, {
        label: t.admin.onboarding.goLive.share.qrAlt.replace(
          '{name}',
          business.name,
        ),
      })
    : '';

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <header className="mb-5">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">
          {t.admin.calendarTitle} · {business.name}
        </h1>
      </header>

      {/* קיצור בלחיצה אחת לעורך עמוד הפרימיום — התיקון המרכזי לגילוי הפיצ׳ר. */}
      <a
        href="/admin/onboarding?edit=premium"
        dir="rtl"
        className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#C59D5F]/40 bg-gradient-to-l from-[#0B1526] to-[#132038] px-5 py-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F2D695]">
            {t.admin.onboarding.premiumEditorCta.eyebrow}
          </p>
          <p className="mt-0.5 text-base font-bold text-white">
            {t.admin.onboarding.premiumEditorCta.title}
          </p>
          <p className="mt-0.5 text-sm text-[#c9d2e2]">
            {t.admin.onboarding.premiumEditorCta.subtitle}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-l from-[#C59D5F] to-[#F2D695] px-5 py-2.5 text-sm font-bold text-[#0B1526] shadow transition hover:brightness-105">
          ✨ {t.admin.onboarding.premiumEditorCta.cta}
        </span>
      </a>

      {pendingCount > 0 ? (
        <a
          href="/admin/appointments?tab=pending"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 transition hover:bg-amber-100"
        >
          <span className="text-sm font-semibold">
            {t.admin.pendingApprovals.bannerPrefix} {pendingCount}{' '}
            {pendingCount === 1
              ? t.admin.pendingApprovals.bannerSuffixOne
              : t.admin.pendingApprovals.bannerSuffixMany}
          </span>
          <span className="whitespace-nowrap text-sm font-medium underline">
            {t.admin.pendingApprovals.cta}
          </span>
        </a>
      ) : null}

      {isLive ? (
        <ShareBanner
          url={bookingLink}
          qrSvg={bookingQr}
          businessName={business.name}
        />
      ) : null}

      {showChecklist ? <OnboardingChecklist items={checklistItems} /> : null}

      {allStepsComplete ? (
        <GoLivePanel
          url={bookingLink}
          qrSvg={bookingQr}
          businessName={business.name}
          bookingPath={bookingPagePath}
          businessId={business.id}
        />
      ) : null}

      <CalendarBoard
        view={view}
        date={date}
        weekStart={weekStart}
        today={today}
        headerLabel={headerLabel}
        columns={columns}
        appts={appts}
        services={services}
        staff={staff}
        activeStaffId={activeStaffId}
        gridStartMinute={gridStartMinute}
        gridEndMinute={gridEndMinute}
        granularity={granularity}
        defaultDurationMin={defaultDurationMin}
      />
    </main>
  );
}
