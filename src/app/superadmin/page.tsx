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
  upgradeExclusiveAction,
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

/** מדד-על מצטבר בכותרת הפרימיום (סכום לכל הפלטפורמה). */
function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3 text-center"
      style={{
        borderColor: 'rgba(197,157,95,0.35)',
        backgroundColor: 'rgba(8,16,28,0.55)',
      }}
    >
      <div className="text-[11px] font-medium" style={{ color: TEXT_MUTED }}>
        {label}
      </div>
      <div
        className="mt-1 font-display text-xl font-bold tabular-nums sm:text-2xl"
        style={{ color: GOLD_LIGHT }}
      >
        {value}
      </div>
    </div>
  );
}

export default async function SuperadminPage() {
  // שער: רק מיילים ב-PLATFORM_ADMIN_EMAILS. כל אחר (כולל מנותק) ⇒ 404.
  const admin = await getPlatformAdminEmail();
  if (!admin) notFound();

  const businesses = await listAllBusinesses();
  // אגרגציה יעילה יחידה לכל המדדים (ללא N+1).
  const metricsMap = await getBusinessMetricsMap(businesses.map((b) => b.id));

  // סיכום-על לכותרת הפרימיום: סכומי תורים/לקוחות/שווי, וספירת עסקים בתקופת ניסיון.
  let totalAppointments = 0;
  let totalClients = 0;
  let totalValueAgorot = 0;
  let trialingCount = 0;
  for (const b of businesses) {
    const bm = metricsFor(metricsMap, b.id);
    totalAppointments += bm.appointments;
    totalClients += bm.clients;
    totalValueAgorot += bm.appointmentsValueAgorot;
    if (getBusinessAccess(b).state === 'trialing') trialingCount += 1;
  }

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
        <header
          className="mb-8 overflow-hidden rounded-3xl border p-6 sm:p-8"
          style={{
            borderColor: 'rgba(197,157,95,0.35)',
            backgroundImage: `radial-gradient(120% 140% at 100% 0%, ${NAVY_GLOW} 0%, ${NAVY_CARD} 45%, ${NAVY_EDGE} 100%)`,
            boxShadow: '0 24px 60px -30px rgba(0,0,0,0.75)',
          }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div
                className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold"
                style={{ borderColor: 'rgba(197,157,95,0.4)', color: GOLD_LIGHT }}
              >
                <span aria-hidden style={{ color: GOLD_MID }}>
                  ◆
                </span>
                תור צ׳יק · פלטפורמה
              </div>
              <h1
                className="font-display text-3xl font-bold sm:text-4xl"
                style={{ color: GOLD_LIGHT }}
              >
                {s.title}
              </h1>
              <p className="mt-2 max-w-xl text-sm" style={{ color: TEXT_ON_DARK }}>
                {s.subtitle}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs" style={{ color: TEXT_MUTED }}>
                  {s.countLabel.replace('{count}', String(businesses.length))}
                </span>
                {trialingCount > 0 && (
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: NAVY_GLOW, color: GOLD_LIGHT }}
                  >
                    {s.summary.trialing}: {trialingCount}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <InstallApp variant="superadmin" compact />
            </div>
          </div>

          {businesses.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HeroStat label={s.summary.businesses} value={String(businesses.length)} />
              <HeroStat label={s.summary.appointments} value={String(totalAppointments)} />
              <HeroStat label={s.summary.clients} value={String(totalClients)} />
              <HeroStat
                label={s.summary.appointmentsValue}
                value={formatShekelFromAgorot(totalValueAgorot)}
              />
            </div>
          )}
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
                  className="group flex flex-col gap-4 rounded-2xl border p-4 transition duration-200 hover:-translate-y-1"
                  style={{
                    borderColor: 'rgba(197,157,95,0.28)',
                    backgroundColor: NAVY_CARD,
                    boxShadow: '0 18px 42px -28px rgba(0,0,0,0.8)',
                  }}
                >
                  {/* כותרת: שם + תגי חבילה/סטטוס */}
                  <div className="flex flex-col gap-2">
                    <h2
                      className="font-display text-xl font-bold leading-tight"
                      style={{ color: GOLD_LIGHT }}
                    >
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

                  {/* כניסה כבעל העסק (התחזות) — נפתחת בלשונית חדשה מול /admin */}
                  <a
                    href={`/superadmin/impersonate/${b.id}`}
                    target="_blank"
                    rel="noopener"
                    aria-label={s.enterAsOwnerAria.replace('{name}', b.name)}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition hover:brightness-105"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${GOLD_LIGHT} 0%, ${GOLD_MID} 100%)`,
                      color: NAVY_EDGE,
                      boxShadow: '0 10px 24px -14px rgba(197,157,95,0.9)',
                    }}
                  >
                    <span aria-hidden>↗</span>
                    {s.enterAsOwner}
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

                        {/* שדרוג לאקסקלוסיב */}
                        <form action={upgradeExclusiveAction} className="flex flex-col gap-2">
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
                            style={{ backgroundColor: GOLD_LIGHT, color: NAVY_EDGE }}
                          >
                            {s.upgradeExclusive.submit}
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
