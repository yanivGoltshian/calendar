/* ── מקור האמת היחיד לניווט אזור הניהול ──
   כל משטח ניווט (ניווט תחתון, גיליון "עוד") נגזר מהמודל הזה בלבד, כדי שלא
   ייווצר שוב פיצול שבו נתיבים שהוסרו זולגים חזרה. הטסטים נועלים את הרשימה
   הזו: בדיוק 13 פריטי whitelist, ואף אחד מהנתיבים שהוסרו לא מופיע. */

export type AdminNavAction = 'link' | 'bell' | 'install' | 'logout';

export type AdminNavItem = {
  id: string;
  label: string;
  sub?: string;
  href?: string;
  action: AdminNavAction;
};

/** ניווט תחתון קבוע (4 נתיבים) + כפתור "עוד" שנפתח כגיליון. */
export const ADMIN_BOTTOM_NAV: AdminNavItem[] = [
  { id: 'home', label: 'יומן', href: '/admin', action: 'link' },
  { id: 'appointments', label: 'הזמנות', href: '/admin/appointments', action: 'link' },
  { id: 'clients', label: 'לקוחות', href: '/admin/clients', action: 'link' },
  { id: 'services', label: 'שירותים', href: '/admin/services', action: 'link' },
];

/** שורות גיליון "עוד" (9 פריטים) — הטקסט verbatim מהמוקאפ המאושר. */
export const ADMIN_MORE_ROWS: AdminNavItem[] = [
  { id: 'team', label: 'צוות', sub: 'ניהול אנשי הצוות', href: '/admin/team', action: 'link' },
  {
    id: 'working-hours',
    label: 'שעות עבודה',
    sub: 'ימי וזמני הפעילות',
    href: '/admin/working-hours',
    action: 'link',
  },
  {
    id: 'stats',
    label: 'סטטיסטיקות',
    sub: 'הכנסות ופילוח שירותים',
    href: '/admin/stats',
    action: 'link',
  },
  {
    id: 'waitlist',
    label: 'רשימת המתנה',
    sub: 'לקוחות בהמתנה לתור',
    href: '/admin/waitlist',
    action: 'link',
  },
  {
    id: 'notifications',
    label: 'תזכורות והודעות',
    sub: 'אישורים ותזכורות מהפעמון',
    action: 'bell',
  },
  {
    id: 'upgrade',
    label: 'שדרוג והצעת מחיר',
    sub: 'חבילת הפרימיום שלכם',
    href: '/admin/upgrade',
    action: 'link',
  },
  { id: 'help', label: 'עזרה ותמיכה', sub: 'מרכז העזרה והתמיכה', href: '/admin/help', action: 'link' },
  { id: 'install', label: 'התקנת האפליקציה', sub: 'הוספה למסך הבית', action: 'install' },
  { id: 'logout', label: 'התנתקות', sub: 'יציאה מהחשבון', action: 'logout' },
];

/** כל 13 פריטי הניווט המותרים באדמין (ניווט תחתון + גיליון "עוד"). */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [...ADMIN_BOTTOM_NAV, ...ADMIN_MORE_ROWS];

/** הנתיבים היחידים המותרים בכל משטח ניווט (נגזר מהמודל, לשימוש בטסטים). */
export const ADMIN_WHITELIST_PATHS: string[] = ADMIN_NAV_ITEMS.filter(
  (i) => i.action === 'link' && i.href,
).map((i) => i.href as string);

/** נתיבים שהוסרו במפורש מכל ניווט האדמין (ההגדרות נגישות דרך זרימותיהן וניווט ישיר, לא מטבעת ההשלמה). */
export const ADMIN_REMOVED_PATHS: string[] = [
  '/admin/pos',
  '/admin/inventory',
  '/admin/documents',
  '/admin/marketing',
  '/admin/punch-cards',
  '/admin/onboarding',
  '/admin/settings',
];

/** האם נתיב הניווט התחתון פעיל עבור ה-pathname הנוכחי. */
export function isAdminNavActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}
