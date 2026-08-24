import Link from 'next/link';
import {
  computeCalendarSyncStatus,
  getCalendarRedirectUri,
} from '@/server/google/calendarConfig';
import {
  getConnectionByStaffId,
  resolveOwnerStaffId,
} from '@/server/repos/calendarConnection';
import {
  disconnectCalendarAction,
  setCalendarToggleAction,
} from '../calendar/actions';

type Props = {
  business: {
    id: string;
    name: string;
    ownerEmail: string | null;
  };
  resultCode?: string;
};

// מיפוי קודי התוצאה מזרימת ה-OAuth להודעות בעברית (calendar=<reason>).
const RESULT_MESSAGES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  connected: { tone: 'ok', text: 'יומן Google חובר בהצלחה.' },
  denied: { tone: 'warn', text: 'החיבור בוטל. לא ניתנה הרשאה ליומן.' },
  no_refresh: {
    tone: 'warn',
    text: 'החיבור לא הושלם. נסו שוב ואשרו את כל ההרשאות במסך של Google.',
  },
  scope_error: {
    tone: 'warn',
    text: 'החיבור לא הושלם. יש לאשר את ההרשאה לצפייה וניהול היומן.',
  },
  state_error: {
    tone: 'warn',
    text: 'פג תוקף בקשת החיבור. התחילו שוב מכאן.',
  },
  missing_code: { tone: 'warn', text: 'החיבור לא הושלם. נסו שוב.' },
  exchange_error: {
    tone: 'warn',
    text: 'אירעה תקלה מול Google בעת החיבור. נסו שוב בעוד רגע.',
  },
  config_error: {
    tone: 'warn',
    text: 'הגדרת החיבור חסרה. פנו לתמיכה של תור צ׳יק.',
  },
  disabled: {
    tone: 'warn',
    text: 'סנכרון היומן אינו פעיל כרגע.',
  },
};

/**
 * מקטע "סנכרון יומן Google" בהגדרות הניהול. מוצג רק כשהדגל
 * GOOGLE_CALENDAR_SYNC_ENABLED דלוק (אחרת מוסתר לחלוטין כדי לא להציג זרימה
 * שבורה). שני מצבים: לא מחובר (כפתור חיבור) ומחובר (מייל, שני מתגים, ניתוק).
 */
export default async function CalendarSyncSection({ business, resultCode }: Props) {
  const status = computeCalendarSyncStatus(process.env);
  // מוסתר לחלוטין כל עוד היכולת אינה מופעלת בסביבה.
  if (!status.enabled) return null;
  // ללא מייל בעלים לא ניתן לפתור את איש הצוות של הבעלים.
  if (!business.ownerEmail) return null;

  const staffId = await resolveOwnerStaffId({
    id: business.id,
    ownerEmail: business.ownerEmail,
    name: business.name,
  });
  const connection = await getConnectionByStaffId(staffId);
  const banner = resultCode ? RESULT_MESSAGES[resultCode] : undefined;

  return (
    <section
      dir="rtl"
      className="mt-10 rounded-2xl border border-[#e7ddcd] bg-white p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-bold text-[#1b1715]">סנכרון יומן Google</h2>
          <p className="mt-1 text-sm leading-relaxed text-[#8f8478]">
            חברו את יומן Google האישי כדי שאירועים אישיים יחסמו זמינות אצלנו,
            והתורים שנקבעים יופיעו אוטומטית ביומן שלכם.
          </p>
        </div>
      </div>

      {banner ? (
        <div
          className={
            banner.tone === 'ok'
              ? 'mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800'
          }
        >
          {banner.text}
        </div>
      ) : null}

      {connection ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7ddcd] bg-[#f7f2ea] px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#8f8478]">חשבון מחובר</p>
              <p className="truncate text-sm font-bold text-[#1b1715]">
                {connection.googleEmail || 'יומן Google'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              מחובר
            </span>
          </div>

          {connection.lastError ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              תקלת סנכרון אחרונה: {connection.lastError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-3">
            <CalendarToggle
              field="importBusy"
              current={connection.importBusy}
              title="חסימת זמינות מהיומן האישי"
              description="אירועים אישיים ביומן Google יחסמו שעות תפוסות בעמוד ההזמנות."
            />
            <CalendarToggle
              field="exportBookings"
              current={connection.exportBookings}
              title="הוספת תורים ליומן האישי"
              description="כל תור שנקבע או מבוטל יתעדכן אוטומטית ביומן Google שלכם."
            />
          </div>

          <form action={disconnectCalendarAction} className="mt-5">
            <button
              type="submit"
              className="min-h-[44px] rounded-lg border border-[#d6c8b4] bg-white px-4 py-2 text-sm font-bold text-[#4a4038] transition hover:bg-[#efe6d8]"
            >
              ניתוק יומן Google
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-5">
          <Link
            href="/admin/calendar/google/connect"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            חיבור יומן Google
          </Link>
          <p className="mt-3 text-xs leading-relaxed text-[#8f8478]">
            תועברו למסך ההרשאות של Google. אנו מבקשים גישה ליומן בלבד, לצורך
            חסימת זמינות והוספת תורים.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * מתג בודד כטופס: הכפתור שולח את הערך ההפוך לערך הנוכחי (flip), עם field+value
 * מפורשים כדי לעקוף את דו-המשמעות של checkbox לא-מסומן.
 */
function CalendarToggle({
  field,
  current,
  title,
  description,
}: {
  field: 'importBusy' | 'exportBookings';
  current: boolean;
  title: string;
  description: string;
}) {
  return (
    <form
      action={setCalendarToggleAction}
      className="flex items-center justify-between gap-3 rounded-xl border border-[#e7ddcd] bg-white px-4 py-3"
    >
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={current ? 'false' : 'true'} />
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#1b1715]">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[#8f8478]">{description}</p>
      </div>
      <button
        type="submit"
        role="switch"
        aria-checked={current}
        aria-label={title}
        className={
          current
            ? 'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-brand-600 transition'
            : 'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-[#d6c8b4] transition'
        }
      >
        <span
          className={
            current
              ? 'inline-block h-5 w-5 -translate-x-0.5 transform rounded-full bg-white shadow transition'
              : 'inline-block h-5 w-5 -translate-x-5 transform rounded-full bg-white shadow transition'
          }
        />
      </button>
    </form>
  );
}
