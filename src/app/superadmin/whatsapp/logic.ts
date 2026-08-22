import {
  classifyStatus,
  effectiveMonthlyCost,
  formatShekelFromAgorot,
  isBlockedForMonth,
  type BusinessCostState,
  type CostStatus,
} from '@/server/whatsapp/cost';

/**
 * לוגיקה טהורה ללוח מנהל-העל של עלויות הוואטסאפ. אין כאן DB/רשת — רק עיצוב שורות
 * לתצוגה מתוך רשומות העסקים, מפת מוני-ההודעות לחודש, וספי הקונפיג. ניתן לבדיקה מלאה.
 */

/** שדות העסק הנדרשים לשורת הלוח (תת-קבוצה של Business). */
export interface WhatsAppBusinessInput extends BusinessCostState {
  id: string;
  name: string;
  ownerEmail: string | null;
  plan: string | null;
}

/** שורת תצוגה מעובדת ללוח. */
export interface WhatsAppDashboardRow {
  id: string;
  name: string;
  ownerEmail: string | null;
  plan: string | null;
  /** מספר הודעות שנשלחו החודש (SENT). */
  monthCount: number;
  /** הצובר האפקטיבי לחודש הנוכחי (אגורות). */
  costAgorot: number;
  /** הצובר בשקלים לתצוגה, למשל "40.00". */
  costShekel: string;
  /** סיווג מצב: תקין / אזהרה / חסום. */
  status: CostStatus;
  /** תווית התגית בעברית. */
  badge: string;
  /** האם העסק חסום כרגע לחודש זה (שער טרום-שליחה). */
  blocked: boolean;
  /** האם אושרה חריגה לחודש הנוכחי. */
  overrideApproved: boolean;
}

/** ספי הקונפיג הדרושים לעיצוב (אגורות). */
export interface DashboardThresholds {
  warnAgorot: number;
  blockAgorot: number;
}

/** תווית תגית לפי סטטוס וספים (₪), למשל "⚠️ מעל 40" / "⛔ חסום מעל 45". */
export function badgeLabel(status: CostStatus, thresholds: DashboardThresholds): string {
  if (status === 'blocked') {
    return `⛔ חסום מעל ${formatShekelWhole(thresholds.blockAgorot)}`;
  }
  if (status === 'warn') {
    return `⚠️ מעל ${formatShekelWhole(thresholds.warnAgorot)}`;
  }
  return 'תקין';
}

/** מציג סכום אגורות בשקלים שלמים כשאין שארית (40), אחרת עם שתי ספרות (40.50). */
function formatShekelWhole(agorot: number): string {
  const shekel = Math.round(agorot) / 100;
  return Number.isInteger(shekel) ? String(shekel) : shekel.toFixed(2);
}

/**
 * מעצב שורה בודדת: מחשב צובר אפקטיבי, סטטוס (חסימה בפועל גוברת על סיווג הצובר),
 * ותגית. חסימה נקבעת לפי isBlockedForMonth (מכבד אישור חריגה ומעבר חודש).
 */
export function shapeRow(
  business: WhatsAppBusinessInput,
  month: string,
  monthCount: number,
  thresholds: DashboardThresholds,
): WhatsAppDashboardRow {
  const costAgorot = effectiveMonthlyCost(business, month);
  const blocked = isBlockedForMonth(business, month, thresholds.blockAgorot);
  // חסימה בפועל גוברת; אחרת מסווגים לפי הצובר אך ללא 'blocked' (חריגה אושרה וכו').
  let status: CostStatus;
  if (blocked) {
    status = 'blocked';
  } else {
    const byCost = classifyStatus(costAgorot, thresholds.warnAgorot, thresholds.blockAgorot);
    status = byCost === 'blocked' ? 'warn' : byCost;
  }
  return {
    id: business.id,
    name: business.name,
    ownerEmail: business.ownerEmail,
    plan: business.plan,
    monthCount,
    costAgorot,
    costShekel: formatShekelFromAgorot(costAgorot),
    status,
    badge: badgeLabel(status, thresholds),
    blocked,
    overrideApproved: business.whatsappOverrideApprovedForMonth === month,
  };
}

/**
 * מעצב ומסדר את כל שורות הלוח: חסומים תחילה, אחר כך אזהרות, אחר כך לפי צובר יורד,
 * ולבסוף לפי שם. כך העסקים הדורשים טיפול צפים לראש.
 */
export function shapeDashboardRows(
  businesses: WhatsAppBusinessInput[],
  month: string,
  monthCounts: Map<string, number>,
  thresholds: DashboardThresholds,
): WhatsAppDashboardRow[] {
  const rows = businesses.map((b) => shapeRow(b, month, monthCounts.get(b.id) ?? 0, thresholds));
  const rank: Record<CostStatus, number> = { blocked: 0, warn: 1, ok: 2 };
  return rows.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.costAgorot !== b.costAgorot) return b.costAgorot - a.costAgorot;
    return a.name.localeCompare(b.name, 'he');
  });
}

/** סיכום עליון ללוח: מספר עסקים בכל מצב וסך העלות המשוערת החודש (₪). */
export interface DashboardSummary {
  total: number;
  blocked: number;
  warn: number;
  ok: number;
  totalCostShekel: string;
}

/** מחשב את סיכום הלוח מתוך השורות המעובדות. */
export function summarize(rows: WhatsAppDashboardRow[]): DashboardSummary {
  let blocked = 0;
  let warn = 0;
  let ok = 0;
  let totalAgorot = 0;
  for (const r of rows) {
    totalAgorot += r.costAgorot;
    if (r.status === 'blocked') blocked += 1;
    else if (r.status === 'warn') warn += 1;
    else ok += 1;
  }
  return {
    total: rows.length,
    blocked,
    warn,
    ok,
    totalCostShekel: formatShekelFromAgorot(totalAgorot),
  };
}
