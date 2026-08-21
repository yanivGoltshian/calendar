import { t } from '@/i18n';
import type { AccessState } from '@/server/subscription';

export type AdminNotificationKind = 'approval' | 'renewal';

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  title: string;
  href: string;
};

/** סף הימים שבו מוצגת התראת חידוש מנוי לעסק פרימיום פעיל. */
export const RENEWAL_REMINDER_DAYS = 7;

function renewalTitle(state: AccessState, daysLeft: number): string {
  const n = t.admin.notifications;
  const days = Math.max(0, daysLeft);
  if (state === 'trialing') {
    if (days <= 0) return n.renewalTrialToday;
    if (days === 1) return n.renewalTrialTomorrow;
    return n.renewalTrialDays.replace('{days}', String(days));
  }
  if (days <= 0) return n.renewalActiveToday;
  if (days === 1) return n.renewalActiveTomorrow;
  return n.renewalActiveDays.replace('{days}', String(days));
}

/**
 * בונה את רשימת ההתראות המרוכזות בפעמון: תורים הממתינים לאישור וחידוש מנוי.
 * טהור וניתן לבדיקה — לא נוגע ב-DOM ולא קורא ל-DB.
 */
export function buildAdminNotifications(input: {
  pendingCount: number;
  access: Pick<import('@/server/subscription').BusinessAccess, 'state' | 'daysLeft'>;
}): AdminNotification[] {
  const { pendingCount, access } = input;
  const items: AdminNotification[] = [];

  if (pendingCount > 0) {
    const n = t.admin.notifications;
    const title =
      pendingCount === 1
        ? n.approvalOne
        : n.approvalMany.replace('{count}', String(pendingCount));
    items.push({
      id: 'pending-approvals',
      kind: 'approval',
      title,
      href: '/admin/appointments?tab=pending',
    });
  }

  // חידוש: בניסיון תמיד (הניסיון תמיד מסתיים); בפרימיום פעיל רק כשקרוב הסוף.
  const showRenewal =
    access.state === 'trialing' ||
    (access.state === 'active' && access.daysLeft <= RENEWAL_REMINDER_DAYS);
  if (showRenewal) {
    items.push({
      id: 'subscription-renewal',
      kind: 'renewal',
      title: renewalTitle(access.state, access.daysLeft),
      href: '/admin/upgrade',
    });
  }

  return items;
}
