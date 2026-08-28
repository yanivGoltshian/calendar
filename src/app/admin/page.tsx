import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { t } from '@/i18n';
import { auth } from '@/auth';
import { getActiveBusiness } from '@/server/repos/business';
import {
  listStaff,
  ensureOwnerStaffMember,
  resolveOwnerDisplayName,
} from '@/server/repos/staff';
import { listServices } from '@/server/repos/services';
import { getBusinessHours } from '@/server/repos/workingHours';
import {
  getAppointmentsForBusinessRange,
  countPendingAppointments,
  countRecentClientCancellations,
  countAppointmentsInRange,
  sumRevenueAgorotInRange,
} from '@/server/repos/appointments';
import { getBusinessAccess } from '@/server/subscription';
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
import { buildAdminNotifications } from './notifications';
import HomeShell, { type ToolStep } from './home/HomeShell';
import { bookingUrl, bookingPath, isBusinessLive } from '@/lib/booking-link';
import { bookingQrSvg } from '@/lib/qr-svg';
import { LEGAL_COMPANY } from '@/content/legal/meta';
import './home/home.css';
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

  // ── מצב ההקמה (setup) — נתוני אמת בלבד, לרצועת ההקמה ולמגירת הכלים ─────────────
  // כל צעד נגזר מנתוני העסק בפועל כדי שהרצועה תהיה ניתנת להמשך מכל מכשיר.
  const businessHours = await getBusinessHours(business.id);
  const pendingCount = await countPendingAppointments(business.id);

  const servicesDone = serviceRows.length > 0;
  const staffDone = staffRows.length > 0;
  const workingHoursDone = businessHours.length > 0;
  const brandingDone = Boolean(
    business.logoUrl || business.brandColor || business.coverImageUrl,
  );
  const detailsDone = business.settings?.onboardingCompleted === true;

  const setupFlags = [
    servicesDone,
    staffDone,
    workingHoursDone,
    brandingDone,
    detailsDone,
  ];
  const setupDone = setupFlags.filter(Boolean).length;
  const percent = Math.round((setupDone / setupFlags.length) * 100);
  const allComplete = setupDone === setupFlags.length;
  const remaining = setupFlags.length - setupDone;

  // מגירת הכלים: חמשת אזורי ההקמה. תיקון באג 1 — "פרטי העסק ומדיניות" מפנה
  // ל-/admin/settings (מדיניות וביטולים), לא לעורך הגלריה/הפרימיום.
  const steps: ToolStep[] = [
    {
      title: 'שירותים ומחירים',
      sub: `${serviceRows.length} שירותים פעילים`,
      done: servicesDone,
      href: '/admin/services',
    },
    {
      title: 'צוות',
      sub: `${staffRows.length} אנשי צוות`,
      done: staffDone,
      href: '/admin/team',
    },
    {
      title: 'שעות פעילות',
      sub: hoursLabelFrom(businessHours.map((h) => h.weekday)),
      done: workingHoursDone,
      href: '/admin/working-hours',
    },
    {
      title: 'מיתוג',
      sub: 'לוגו, צבע וכיסוי',
      done: brandingDone,
      href: '/admin/settings',
    },
    {
      title: 'פרטי העסק ומדיניות',
      sub: 'מדיניות ביטולים, כתובת ופרטי קשר',
      done: detailsDone,
      href: '/admin/settings',
    },
  ];

  // תוויות רצועת ההקמה — טקסט מדויק לפי המוקאפ, נגזר מהצעד הפתוח הראשון.
  const CONTINUE_LABELS = [
    'את השירותים והמחירים',
    'את פרטי הצוות',
    'את שעות הפעילות',
    'את המיתוג',
    'את פרטי העסק והמדיניות',
  ];
  const firstOpenIndex = setupFlags.findIndex((f) => !f);
  const continueLabel = CONTINUE_LABELS[firstOpenIndex >= 0 ? firstOpenIndex : 0];
  const setupTitle =
    remaining <= 1
      ? 'כמעט שם · נותר צעד אחד'
      : `עוד רגע לסיום · נותרו ${remaining} צעדים`;
  const setupSubtitle =
    remaining <= 1
      ? `השלימו ${continueLabel} והעמוד יהיה מושלם`
      : `נותרו ${remaining} צעדים קטנים והעמוד שלכם מושלם`;

  // ── מרכז ההתראות בפעמון — משוחזר כמו ב-layout (אישורים, ביטולים, חידוש מנוי) ──
  const access = getBusinessAccess(business);
  const cancellationSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCancellations = await countRecentClientCancellations(
    business.id,
    cancellationSince,
  );
  const notifications = buildAdminNotifications({
    pendingCount,
    recentCancellations,
    access,
  });

  // ── קישור השיתוף וקוד ה-QR (נבנים בשרת כדי לא לטעון ספריית QR בדפדפן) ─────────
  const isLive = isBusinessLive({
    serviceCount: serviceRows.length,
    workingHoursCount: businessHours.length,
  });
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
  const urlDisplay = bookingLink.replace(/^https?:\/\//, '');

  // ── כרטיסי הסטטיסטיקה — נתוני אמת: תורים היום, ממתינים, הכנסה חודשית מצטברת ────
  const todayCount = await countAppointmentsInRange(
    business.id,
    midnightUtc(today, tz),
    midnightUtc(addDaysToDateString(today, 1), tz),
  );

  const monthStartStr = `${today.slice(0, 4)}-${today.slice(5, 7)}-01`;
  const monthYear = Number(today.slice(0, 4));
  const monthNum = Number(today.slice(5, 7));
  const nextMonthYear = monthNum === 12 ? monthYear + 1 : monthYear;
  const nextMonthNum = monthNum === 12 ? 1 : monthNum + 1;
  const monthEndStr = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-01`;
  const revenueAgorot = await sumRevenueAgorotInRange(
    business.id,
    midnightUtc(monthStartStr, tz),
    midnightUtc(monthEndStr, tz),
  );
  const revenueDisplay = `₪${Math.round(revenueAgorot / 100).toLocaleString('he-IL')}`;

  // ── ברכה אישית: שם הבעלים (עם נפילה־לאחור) + תאריך עברי מלא ───────────────────
  const session = await auth();
  const ownerDisplayName = resolveOwnerDisplayName({
    ownerName: session?.user?.name ?? null,
    businessName: business.name,
    ownerEmail: business.ownerEmail,
  });
  const greetingDate = new Intl.DateTimeFormat('he-IL', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const greeting = `שלום ${ownerDisplayName} · ${greetingDate}`;
  const logoLetter = business.name.trim().charAt(0) || 'ת';
  const helpHref = `mailto:${LEGAL_COMPANY.contactEmail}`;

  return (
    <div className="tcah">
      <HomeShell
        logoLetter={logoLetter}
        bizName={business.name}
        greeting={greeting}
        notifications={notifications}
        isLive={isLive}
        share={{
          urlDisplay,
          bookingLink,
          bookingPagePath,
          qrSvg: bookingQr,
          shareText: t.admin.onboarding.goLive.share.shareText.replace(
            '{name}',
            business.name,
          ),
          copiedLabel: t.admin.onboarding.goLive.share.copied,
          copyFailedLabel: t.admin.onboarding.goLive.share.copyFailed,
        }}
        todayCount={todayCount}
        pendingCount={pendingCount}
        revenueDisplay={revenueDisplay}
        pendingHref="/admin/appointments?tab=pending"
        revenueHref="/admin/stats"
        allComplete={allComplete}
        percent={percent}
        setupTitle={setupTitle}
        setupSubtitle={setupSubtitle}
        premiumHref="/admin/onboarding?edit=premium"
        steps={steps}
        helpHref={helpHref}
        calendar={
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
        }
      />
    </div>
  );
}

/**
 * תווית ימי הפעילות מרשימת מספרי ימים (0=ראשון..6=שבת): טווח רציף → "ראשון עד חמישי";
 * יום בודד → שם היחיד; אחרת רשימה מופרדת ב-"·". טהורה, לשימוש ברצועת/מגירת ההקמה.
 */
function hoursLabelFrom(weekdays: number[]): string {
  const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const active = [...new Set(weekdays)].sort((a, b) => a - b);
  if (active.length === 0) return 'טרם הוגדרו';
  if (active.length === 1) return names[active[0]];
  const first = active[0];
  const last = active[active.length - 1];
  const contiguous = active.every((d, i) => d === first + i);
  if (contiguous) return `${names[first]} עד ${names[last]}`;
  return active.map((d) => names[d]).join(' · ');
}
