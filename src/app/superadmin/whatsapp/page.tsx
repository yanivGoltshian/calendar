import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listAllBusinesses } from '@/server/repos/business';
import { getPlatformAdminEmail } from '@/server/platformAdmin';
import { loadWhatsAppConfig } from '@/server/whatsapp/config';
import { currentMonth } from '@/server/whatsapp/cost';
import { prisma } from '@/lib/db';
import {
  shapeDashboardRows,
  summarize,
  type WhatsAppBusinessInput,
  type WhatsAppDashboardRow,
} from './logic';
import { approveOverrideAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'עלויות וואטסאפ · ניהול-על',
  robots: { index: false, follow: false },
};

const NAVY_BASE = '#0B1526';
const NAVY_EDGE = '#08101C';
const NAVY_CARD = '#0F1B30';
const NAVY_GLOW = '#16233A';
const GOLD_LIGHT = '#F2D695';
const GOLD_MID = '#C59D5F';
const TEXT_ON_DARK = '#E8ECF3';
const TEXT_MUTED = '#9AA7BD';

/** צבעי תגית לפי סטטוס. */
function badgeStyle(status: WhatsAppDashboardRow['status']): { bg: string; fg: string } {
  if (status === 'blocked') return { bg: '#331A1A', fg: '#F0B5B5' };
  if (status === 'warn') return { bg: '#33280F', fg: '#F2D695' };
  return { bg: '#123021', fg: '#8FE3B0' };
}

/** תא סיכום עליון. */
function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{ borderColor: NAVY_GLOW, backgroundColor: NAVY_CARD }}
    >
      <div className="text-xs" style={{ color: TEXT_MUTED }}>
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

export default async function WhatsAppCostPage() {
  // שער: רק מיילים ב-PLATFORM_ADMIN_EMAILS. כל אחר (כולל מנותק) ⇒ 404.
  const admin = await getPlatformAdminEmail();
  if (!admin) notFound();

  const config = loadWhatsAppConfig();
  const month = currentMonth();

  const businesses = await listAllBusinesses();

  // ספירת הודעות שנשלחו בפועל (SENT) החודש, באגרגציה יחידה (ללא N+1).
  const sentRows = await prisma.whatsAppMessageLog.groupBy({
    by: ['businessId'],
    where: { month, status: 'SENT' },
    _count: { _all: true },
  });
  const monthCounts = new Map<string, number>(
    sentRows.map((r) => [r.businessId, r._count._all]),
  );

  const inputs: WhatsAppBusinessInput[] = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    ownerEmail: b.ownerEmail,
    plan: b.plan,
    monthlyWhatsappCostAgorot: b.monthlyWhatsappCostAgorot,
    whatsappCostMonth: b.whatsappCostMonth,
    whatsappBlocked: b.whatsappBlocked,
    whatsappWarn40SentForMonth: b.whatsappWarn40SentForMonth,
    whatsappOverrideApprovedForMonth: b.whatsappOverrideApprovedForMonth,
  }));

  const rows = shapeDashboardRows(inputs, month, monthCounts, {
    warnAgorot: config.warnAgorot,
    blockAgorot: config.blockAgorot,
  });
  const summary = summarize(rows);

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
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/superadmin"
              className="text-xs font-semibold"
              style={{ color: TEXT_MUTED }}
            >
              → חזרה לניהול-על
            </a>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl" style={{ color: GOLD_LIGHT }}>
            עלויות וואטסאפ
          </h1>
          <p className="mt-1 text-sm" style={{ color: TEXT_MUTED }}>
            מעקב חודשי אחר שליחת הודעות וואטסאפ בערוץ הבלעדי, לכל עסק, לחודש הקלנדרי הנוכחי.
          </p>
          <p className="mt-2 text-xs" style={{ color: TEXT_MUTED }} dir="ltr">
            <code>{month}</code>
          </p>
        </header>

        {/* סיכום עליון */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="סך עסקים" value={String(summary.total)} accent={TEXT_ON_DARK} />
          <SummaryCard label="עלות כוללת החודש (₪)" value={summary.totalCostShekel} accent={GOLD_LIGHT} />
          <SummaryCard label="באזהרה" value={String(summary.warn)} accent="#F2D695" />
          <SummaryCard label="חסומים" value={String(summary.blocked)} accent="#F0B5B5" />
        </div>

        {rows.length === 0 ? (
          <p
            className="rounded-2xl border p-8 text-center text-sm"
            style={{ backgroundColor: NAVY_EDGE, borderColor: NAVY_GLOW, color: TEXT_MUTED }}
          >
            אין עדיין נתוני שליחה החודש.
          </p>
        ) : (
          <div
            className="overflow-x-auto rounded-2xl border"
            style={{ borderColor: NAVY_GLOW, backgroundColor: NAVY_CARD }}
          >
            <table className="w-full min-w-[720px] border-collapse text-right text-sm">
              <thead>
                <tr style={{ color: GOLD_MID }}>
                  <th className="px-4 py-3 font-semibold">עסק</th>
                  <th className="px-4 py-3 font-semibold">הודעות החודש</th>
                  <th className="px-4 py-3 font-semibold">עלות מוערכת (₪)</th>
                  <th className="px-4 py-3 font-semibold">סטטוס</th>
                  <th className="px-4 py-3 font-semibold">פעולה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const badge = badgeStyle(row.status);
                  return (
                    <tr
                      key={row.id}
                      className="border-t"
                      style={{ borderColor: NAVY_GLOW }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold" style={{ color: TEXT_ON_DARK }}>
                          {row.name}
                        </div>
                        {row.ownerEmail ? (
                          <div className="text-xs" style={{ color: TEXT_MUTED }} dir="ltr">
                            <code>{row.ownerEmail}</code>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: TEXT_ON_DARK }}>
                        {row.monthCount}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: GOLD_LIGHT }}>
                        {row.costShekel}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ backgroundColor: badge.bg, color: badge.fg }}
                        >
                          {row.badge}
                        </span>
                        {row.overrideApproved ? (
                          <div className="mt-1 text-[11px]" style={{ color: TEXT_MUTED }}>
                            אושרה חריגה החודש
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {row.blocked ? (
                          <form action={approveOverrideAction}>
                            <input type="hidden" name="businessId" value={row.id} />
                            <button
                              type="submit"
                              className="min-h-[40px] whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold"
                              style={{ backgroundColor: GOLD_MID, color: NAVY_EDGE }}
                            >
                              אשר חריגה
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs" style={{ color: TEXT_MUTED }}>
                            —
                          </span>
                        )}
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
