import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listAllBusinesses } from '@/server/repos/business';
import { getBusinessAccess, describeAccessState, describePlan } from '@/server/subscription';
import { getPlatformAdminEmail } from '@/server/platformAdmin';
import { t } from '@/i18n';
import { extendTrialAction, upgradePremiumAction, revertToBasicAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ניהול-על',
  robots: { index: false, follow: false },
};

const s = t.billing.superadmin;

const NAVY_BASE = '#0B1526';
const NAVY_EDGE = '#08101C';
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

/** ₪ מאגורות, או מקף. */
function fmtShekel(agorot: number | null): string {
  if (agorot == null) return s.none;
  const shekel = agorot / 100;
  return `₪${shekel.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

export default async function SuperadminPage() {
  // שער: רק מיילים ב-PLATFORM_ADMIN_EMAILS. כל אחר (כולל מנותק) ⇒ 404.
  const admin = await getPlatformAdminEmail();
  if (!admin) notFound();

  const businesses = await listAllBusinesses();

  const inputClass =
    'w-full rounded-lg border px-2 py-1 text-sm text-[#E8ECF3] placeholder:text-[#6B7890] focus:outline-none focus:ring-2';
  const inputStyle = {
    backgroundColor: NAVY_EDGE,
    borderColor: NAVY_GLOW,
  } as const;

  return (
    <main
      dir="rtl"
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-10"
      style={{ backgroundColor: NAVY_BASE, color: TEXT_ON_DARK }}
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl" style={{ color: GOLD_LIGHT }}>
            {s.title}
          </h1>
          <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
            {s.subtitle}
          </p>
          <p className="mt-2 text-xs" style={{ color: TEXT_MUTED }}>
            {s.countLabel.replace('{count}', String(businesses.length))}
          </p>
        </header>

        {businesses.length === 0 ? (
          <p
            className="rounded-2xl border p-8 text-center text-sm"
            style={{ backgroundColor: NAVY_EDGE, borderColor: NAVY_GLOW, color: TEXT_MUTED }}
          >
            {s.empty}
          </p>
        ) : (
          <div
            className="overflow-x-auto rounded-2xl border"
            style={{ borderColor: NAVY_GLOW, backgroundColor: NAVY_EDGE }}
          >
            <table className="w-full min-w-[1100px] border-collapse text-start text-sm">
              <thead>
                <tr style={{ color: GOLD_MID }} className="text-start">
                  <th className="px-3 py-3 text-start font-semibold">{s.table.name}</th>
                  <th className="px-3 py-3 text-start font-semibold">{s.table.owner}</th>
                  <th className="px-3 py-3 text-start font-semibold">{s.table.plan}</th>
                  <th className="px-3 py-3 text-start font-semibold">{s.table.status}</th>
                  <th className="px-3 py-3 text-start font-semibold">{s.table.daysLeft}</th>
                  <th className="px-3 py-3 text-start font-semibold">{s.table.trialEndsAt}</th>
                  <th className="px-3 py-3 text-start font-semibold">{s.table.paidUntil}</th>
                  <th className="px-3 py-3 text-start font-semibold">{s.table.amount}</th>
                  <th className="px-3 py-3 text-start font-semibold">{s.table.createdAt}</th>
                  <th className="px-3 py-3 text-start font-semibold">{s.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => {
                  const access = getBusinessAccess(b);
                  return (
                    <tr
                      key={b.id}
                      className="align-top"
                      style={{ borderTop: `1px solid ${NAVY_GLOW}` }}
                    >
                      <td className="px-3 py-3">
                        <div className="font-semibold" style={{ color: TEXT_ON_DARK }}>
                          {b.name}
                        </div>
                        <div className="text-xs" style={{ color: TEXT_MUTED }}>
                          {b.slug}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: TEXT_MUTED }}>
                        {b.ownerEmail ?? s.none}
                      </td>
                      <td className="px-3 py-3">{describePlan(b.plan)}</td>
                      <td className="px-3 py-3">{describeAccessState(access.state)}</td>
                      <td className="px-3 py-3">{access.active ? access.daysLeft : 0}</td>
                      <td className="px-3 py-3 text-xs">{fmtDate(b.trialEndsAt)}</td>
                      <td className="px-3 py-3 text-xs">{fmtDate(b.paidUntil)}</td>
                      <td className="px-3 py-3 text-xs">{fmtShekel(b.manualAmountAgorot)}</td>
                      <td className="px-3 py-3 text-xs">{fmtDate(b.createdAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-[280px] flex-col gap-3">
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
                              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold"
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
                              className="rounded-lg px-3 py-1.5 text-xs font-bold"
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
                              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                              style={{ borderColor: NAVY_GLOW, color: TEXT_MUTED }}
                            >
                              {s.revert.submit}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
