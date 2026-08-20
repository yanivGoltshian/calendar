import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listAllBusinesses, getBusinessMetricsMap } from '@/server/repos/business';
import { getBusinessAccess, describeAccessState, describePlan } from '@/server/subscription';
import { getPlatformAdminEmail } from '@/server/platformAdmin';
import { t } from '@/i18n';
import InstallApp from '@/components/pwa/InstallApp';
import {
  extendTrialAction,
  upgradePremiumAction,
  revertToBasicAction,
  editBusinessDetailsAction,
} from './actions';
import PublicSiteLink from './PublicSiteLink';
import { DeleteBusinessForm } from './DeleteBusinessForm';
import {
  metricsFor,
  formatShekelFromAgorot,
  formatShekelOrDash,
  formatDaysLeft,
} from './logic';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ניהול-על',
  applicationName: 'תור צ׳יק · פלטפורמה',
  manifest: '/superadmin/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'תור צ׳יק פלטפורמה',
    statusBarStyle: 'default',
  },
  robots: { index: false, follow: false },
};

const s = t.billing.superadmin;

const NAVY_BASE = '#0B1526';
const NAVY_EDGE = '#08101C';
const NAVY_CARD = '#0F1B30';
const NAVY_GLOW = '#16233A';
const GOLD_LIGHT = '#F2D695';
const GOLD_MID = '#C59D5F';
const TEXT_ON_DARK = '#E8ECF3';
const TEXT_MUTED = '#9AA7BD';

/** מעצב תאריך קצר בעברית, או מקף כשאין ערך. */
function fmtDate(d: Date | null): string {
  if (!d) return s.none;
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(d);
}

const inputClass =
  'w-full min-h-[44px] rounded-lg border px-3 py-2 text-sm text-[#E8ECF3] placeholder:text-[#6B7890] focus:outline-none focus:ring-2';
const inputStyle = {
  backgroundColor: NAVY_EDGE,
  borderColor: NAVY_GLOW,
} as const;

/** תא מטריקה בודד בתוך רשת הנתונים. */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border px-3 py-2"
      style={{ borderColor: NAVY_GLOW, backgroundColor: NAVY_EDGE }}
    >
      <div className="text-[11px]" style={{ color: TEXT_MUTED }}>
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: TEXT_ON_DARK }}>
        {value}
      </div>
    </div>
  );
}

/** שורת תאריך/מידע קצרה. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs" style={{ color: TEXT_MUTED }}>
        {label}
      </span>
      <span className="text-xs font-medium tabular-nums" style={{ color: TEXT_ON_DARK }}>
        {value}
      </span>
    </div>
  );
}

/** מקטע פעולות מתקפל (native details) כדי לשמור על כרטיס קומפקטי במובייל. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border" style={{ borderColor: NAVY_GLOW }}>
      <summary
        className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-semibold"
        style={{ color: GOLD_LIGHT }}
      >
        <span>{title}</span>
        <span
          className="text-xs transition-transform group-open:rotate-180"
          style={{ color: TEXT_MUTED }}
          aria-hidden
        >
          ▾
        </span>
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

export default async function SuperadminPage() {
  // שער: רק מיילים ב-PLATFORM_ADMIN_EMAILS. כל אחר (כולל מנותק) ⇒ 404.
  const admin = await getPlatformAdminEmail();
  if (!admin) notFound();

  const businesses = await listAllBusinesses();
  // אגרגציה יעילה יחידה לכל המדדים (ללא N+1).
  const metricsMap = await getBusinessMetricsMap(businesses.map((b) => b.id));

  return (
    <main
      dir="rtl"
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-10"
      style={{
        backgroundColor: NAVY_BASE,
        color: TEXT_ON_DARK,
        paddingTop: 'max(2rem, env(safe-area-inset-top))',
        paddingInline: 'max(1rem, env(safe-area-inset-right))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1
              className="font-display text-2xl font-bold sm:text-3xl"
              style={{ color: GOLD_LIGHT }}
            >
              {s.title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
              {s.subtitle}
            </p>
            <p className="mt-2 text-xs" style={{ color: TEXT_MUTED }}>
              {s.countLabel.replace('{count}', String(businesses.length))}
            </p>
          </div>
          <div className="shrink-0">
            <InstallApp variant="superadmin" compact />
          </div>
        </header>

        {businesses.length === 0 ? (
          <p
            className="rounded-2xl border p-8 text-center text-sm"
            style={{ backgroundColor: NAVY_EDGE, borderColor: NAVY_GLOW, color: TEXT_MUTED }}
          >
            {s.empty}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {businesses.map((b) => {
              const access = getBusinessAccess(b);
              const m = metricsFor(metricsMap, b.id);
              return (
                <section
                  key={b.id}
                  className="flex flex-col gap-4 rounded-2xl border p-4"
                  style={{ borderColor: NAVY_GLOW, backgroundColor: NAVY_CARD }}
                >
                  {/* כותרת: שם + תגי חבילה/סטטוס */}
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-bold leading-tight" style={{ color: GOLD_LIGHT }}>
                      {b.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: NAVY_GLOW, color: GOLD_LIGHT }}
                      >
                        {describePlan(b.plan)}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: access.active ? '#123021' : '#331A1A',
                          color: access.active ? '#8FE3B0' : '#F0B5B5',
                        }}
                      >
                        {describeAccessState(access.state)}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: TEXT_MUTED }}>
                      {b.ownerEmail ?? s.none}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-xs" style={{ color: TEXT_MUTED }} dir="ltr">
                        {b.slug}
                      </span>
                      <PublicSiteLink slug={b.slug} />
                    </div>
                  </div>

                  {/* כניסה לניהול העסק עצמו */}
                  <a
                    href={`/b/${b.slug}/admin`}
                    className="flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition"
                    style={{ backgroundColor: GOLD_MID, color: NAVY_EDGE }}
                  >
                    {s.manageBusiness}
                  </a>

                  {/* מטריקות פעילות */}
                  <div>
                    <div className="mb-2 text-xs font-semibold" style={{ color: GOLD_MID }}>
                      {s.metrics.title}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Metric label={s.metrics.clients} value={String(m.clients)} />
                      <Metric label={s.metrics.appointments} value={String(m.appointments)} />
                      <Metric
                        label={s.metrics.appointmentsValue}
                        value={formatShekelFromAgorot(m.appointmentsValueAgorot)}
                      />
                      <Metric
                        label={s.metrics.cashReceipts}
                        value={formatShekelFromAgorot(m.cashReceiptsAgorot)}
                      />
                      <Metric
                        label={s.metrics.weCharge}
                        value={formatShekelOrDash(b.manualAmountAgorot)}
                      />
                    </div>
                  </div>

                  {/* תאריכים */}
                  <div className="grid gap-1.5">
                    <Field label={s.dates.trialEndsAt} value={fmtDate(b.trialEndsAt)} />
                    <Field label={s.dates.paidUntil} value={fmtDate(b.paidUntil)} />
                    <Field
                      label={s.dates.daysLeft}
                      value={formatDaysLeft(access.active, access.daysLeft)}
                    />
                    <Field label={s.dates.createdAt} value={fmtDate(b.createdAt)} />
                  </div>

                  {/* פעולות מתקפלות */}
                  <div className="flex flex-col gap-2">
                    <Section title={s.managePlan}>
                      <div className="flex flex-col gap-4 pt-2">
                        {/* הארכת ניסיון */}
                        <form action={extendTrialAction} className="flex items-end gap-2">
                          <input type="hidden" name="businessId" value={b.id} />
                          <label className="flex-1">
                            <span className="mb-1 block text-xs" style={{ color: TEXT_MUTED }}>
                              {s.extendTrial.daysLabel}
                            </span>
                            <input
                              type="number"
                              name="days"
                              min={1}
                              defaultValue={14}
                              className={inputClass}
                              style={inputStyle}
                            />
                          </label>
                          <button
                            type="submit"
                            className="min-h-[44px] whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold"
                            style={{ backgroundColor: NAVY_GLOW, color: GOLD_LIGHT }}
                          >
                            {s.extendTrial.submit}
                          </button>
                        </form>

                        {/* שדרוג לפרימיום */}
                        <form action={upgradePremiumAction} className="flex flex-col gap-2">
                          <input type="hidden" name="businessId" value={b.id} />
                          <label>
                            <span className="mb-1 block text-xs" style={{ color: TEXT_MUTED }}>
                              {s.upgrade.paidUntilLabel}
                            </span>
                            <input
                              type="date"
                              name="paidUntil"
                              required
                              className={inputClass}
                              style={inputStyle}
                            />
                          </label>
                          <label>
                            <span className="mb-1 block text-xs" style={{ color: TEXT_MUTED }}>
                              {s.upgrade.amountLabel}
                            </span>
                            <input
                              type="number"
                              name="amountShekel"
                              min={0}
                              step="1"
                              className={inputClass}
                              style={inputStyle}
                            />
                          </label>
                          <label>
                            <span className="mb-1 block text-xs" style={{ color: TEXT_MUTED }}>
                              {s.upgrade.notesLabel}
                            </span>
                            <input
                              type="text"
                              name="planNotes"
                              className={inputClass}
                              style={inputStyle}
                            />
                          </label>
                          <button
                            type="submit"
                            className="min-h-[44px] rounded-lg px-3 py-2 text-xs font-bold"
                            style={{ backgroundColor: GOLD_MID, color: NAVY_EDGE }}
                          >
                            {s.upgrade.submit}
                          </button>
                        </form>

                        {/* החזרה לבסיס */}
                        <form action={revertToBasicAction}>
                          <input type="hidden" name="businessId" value={b.id} />
                          <button
                            type="submit"
                            className="min-h-[44px] w-full rounded-lg border px-3 py-2 text-xs font-semibold"
                            style={{ borderColor: NAVY_GLOW, color: TEXT_MUTED }}
                          >
                            {s.revert.submit}
                          </button>
                        </form>
                      </div>
                    </Section>

                    <Section title={s.edit.title}>
                      <form action={editBusinessDetailsAction} className="flex flex-col gap-2 pt-2">
                        <input type="hidden" name="businessId" value={b.id} />
                        <label>
                          <span className="mb-1 block text-xs" style={{ color: TEXT_MUTED }}>
                            {s.edit.nameLabel}
                          </span>
                          <input
                            type="text"
                            name="name"
                            defaultValue={b.name}
                            required
                            className={inputClass}
                            style={inputStyle}
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs" style={{ color: TEXT_MUTED }}>
                            {s.edit.phoneLabel}
                          </span>
                          <input
                            type="tel"
                            name="phone"
                            defaultValue={b.phone ?? ''}
                            className={inputClass}
                            style={inputStyle}
                            dir="ltr"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs" style={{ color: TEXT_MUTED }}>
                            {s.edit.ownerEmailLabel}
                          </span>
                          <input
                            type="email"
                            name="ownerEmail"
                            defaultValue={b.ownerEmail ?? ''}
                            className={inputClass}
                            style={inputStyle}
                            dir="ltr"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs" style={{ color: TEXT_MUTED }}>
                            {s.edit.notesLabel}
                          </span>
                          <input
                            type="text"
                            name="planNotes"
                            defaultValue={b.planNotes ?? ''}
                            className={inputClass}
                            style={inputStyle}
                          />
                        </label>
                        <button
                          type="submit"
                          className="min-h-[44px] rounded-lg px-3 py-2 text-xs font-bold"
                          style={{ backgroundColor: NAVY_GLOW, color: GOLD_LIGHT }}
                        >
                          {s.edit.submit}
                        </button>
                      </form>
                    </Section>

                    <Section title={s.delete.title}>
                      <DeleteBusinessForm
                        businessId={b.id}
                        slug={b.slug}
                        inputClass={inputClass}
                        inputStyle={inputStyle}
                      />
                    </Section>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
