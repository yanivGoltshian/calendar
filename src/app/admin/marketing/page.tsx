import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import {
  listCampaigns,
  listMessageLog,
  countSegment,
  type CampaignSegment,
} from '@/server/repos/marketing';
import { parseCampaignChannels } from '@/server/campaigns/channels';
import { getCampaignDeliveryStatus } from '@/server/campaigns/delivery';
import { displayPhone } from '@/lib/crypto';
import { formatDateString, formatTime } from '@/lib/time';
import type { CampaignStatus } from '@prisma/client';
import CampaignForm from './CampaignForm';
import { sendCampaignAction } from './actions';

export const metadata: Metadata = { title: t.admin.marketingModule.title };

function formatWhen(instant: Date): string {
  return `${formatDateString(instant)} · ${formatTime(instant)}`;
}

const STATUS_STYLE: Record<CampaignStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENDING: 'bg-amber-100 text-amber-700',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

export default async function AdminMarketingPage() {
  const business = await getActiveBusiness();
  if (!business) notFound();

  const m = t.admin.marketingModule;
  const delivery = getCampaignDeliveryStatus();

  const [campaigns, messageLog, allCount, activeCount, apptCount] = await Promise.all([
    listCampaigns(business.id),
    listMessageLog(business.id, 50),
    countSegment(business.id, 'all'),
    countSegment(business.id, 'active'),
    countSegment(business.id, 'with_appointments'),
  ]);

  const counts: Record<CampaignSegment, number> = {
    all: allCount,
    active: activeCount,
    with_appointments: apptCount,
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-4">
        <p className="text-sm text-slate-500">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-slate-900">
          {m.title} · {business.name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{m.subtitle}</p>
      </header>

      {delivery.anyLive ? (
        <p className="mb-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {m.liveNote}
        </p>
      ) : (
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {m.devNote}
        </p>
      )}

      <h2 className="mb-3 text-lg font-bold text-slate-900">{m.listTitle}</h2>

      {campaigns.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          {m.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{c.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{m.segments[c.segment as CampaignSegment] ?? m.segments.all}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status]}`}
                >
                  {m.statuses[c.status]}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                {c.body}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-xs text-slate-400">{m.channelsLabel}:</span>
                {parseCampaignChannels(c.channels).map((ch) => (
                  <span
                    key={ch}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    {m.channels[ch]}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span>
                  {m.recipients}: <span className="font-semibold text-slate-700">{c.recipientCount}</span>
                </span>
                <span>
                  {m.sent}: <span className="font-semibold text-green-700">{c.sentCount}</span>
                </span>
                {c.failedCount > 0 ? (
                  <span>
                    {m.failed}: <span className="font-semibold text-red-700">{c.failedCount}</span>
                  </span>
                ) : null}
                {c.status === 'SCHEDULED' && c.scheduledAt ? (
                  <span>
                    {m.scheduledForLabel}: <span dir="ltr">{formatWhen(c.scheduledAt)}</span>
                  </span>
                ) : null}
                {c.sentAt ? <span dir="ltr">{formatWhen(c.sentAt)}</span> : null}
              </div>

              {c.status === 'DRAFT' ? (
                <form action={sendCampaignAction} className="mt-3">
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    {m.sendCta}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <CampaignForm counts={counts} />

      {/* יומן הודעות */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-slate-900">{m.logTitle}</h2>
        {messageLog.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
            {m.logEmpty}
          </p>
        ) : (
          <ul className="space-y-2">
            {messageLog.map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {log.client?.name ?? log.campaign?.name ?? m.logUnknown}
                  </p>
                  <p className="text-slate-400" dir="ltr">
                    {(log.channel === 'email' ? log.address : displayPhone(log.phone)) || log.address || ''} · {formatWhen(log.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    log.status === 'SENT'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {m.messageStatuses[log.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
