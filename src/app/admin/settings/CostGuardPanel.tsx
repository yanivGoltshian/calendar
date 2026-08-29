import { t } from '@/i18n';
import { formatAgorot } from '@/lib/money';
import type { CostGuardStatus } from '@/server/billing/costGuard';
import SettingsSection from './SettingsSection';

type Props = { status: CostGuardStatus };

/**
 * פאנל תצוגה בלבד של שער העלות באזור ההגדרות: מציג את הצבירה החודשית של
 * הודעות בתשלום מול התקרה, מסמן את סף ההתראה, ומחווה חסימה עד תחילת החודש הבא.
 * מוצג רק לעסקי אקסלוסיב, שהם היחידים שמגיעים לערוץ בתשלום ללקוח.
 */
export default function CostGuardPanel({ status }: Props) {
  const labels = t.admin.settings.costGuard;
  const pct =
    status.capAgorot > 0
      ? Math.min(100, Math.round((status.usedAgorot / status.capAgorot) * 100))
      : 0;
  const barColor = status.blocked
    ? 'bg-red-500'
    : status.atAlert
      ? 'bg-amber-500'
      : 'bg-brand-600';

  return (
    <div className="mt-6">
      <SettingsSection title={labels.title} description={labels.description}>
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-600">{labels.usageLabel}</span>
            <span className="font-medium text-slate-900">
              {formatAgorot(status.usedAgorot)} {labels.ofLabel}{' '}
              {formatAgorot(status.capAgorot)}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex items-baseline justify-between text-xs text-slate-500">
            <span>
              {labels.alertLabel}: {formatAgorot(status.alertAgorot)}
            </span>
            <span>
              {labels.remainingLabel}: {formatAgorot(status.remainingAgorot)}
            </span>
          </div>
        </div>
        {status.blocked ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {labels.blockedNotice}
          </p>
        ) : status.atAlert ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {labels.atAlertNotice}
          </p>
        ) : null}
      </SettingsSection>
    </div>
  );
}
