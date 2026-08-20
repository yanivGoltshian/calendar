import { t } from '@/i18n';

/**
 * ניתוב אונבורדינג לבעלי עסק (מקור אמת יחיד, טהור ובר-בדיקה).
 *
 * הרעיון: זהות הבעלים היא ה-email המאומת על Business.ownerEmail. מי שכבר מנהל
 * עסק לעולם לא אמור לנחות שוב על טופס פתיחת עסק (שהיה יוצר עסק כפול/נטוש),
 * אלא להגיע לאזור הניהול הקיים. פתיחת עסק נוסף מחייבת זהות אחרת (חשבון Google
 * אחר או טלפון אחר), ולכן ownerEmail אחר.
 *
 * ההחלטות מרוכזות כאן כפונקציות טהורות כדי שאפשר יהיה לבדוק אותן ישירות,
 * והדפים (page.tsx) רק צורכים אותן.
 */

export const OWNER_ADMIN_HREF = '/admin';
export const NEW_BUSINESS_HREF = '/business/new';
/** ראוטר חכם: אורח מופנה ל-/business/login, בעלים מחובר מופנה ישירות ל-/admin. */
export const OWNER_LOGIN_HREF = '/business/resume';
/** כוונה מפורשת לפתוח עסק נוסף (בזהות אחרת). */
export const ADDITIONAL_BUSINESS_HREF = '/business/new?another=1';

/**
 * מה להציג בעמוד /business/new עבור המבקר הנוכחי.
 * - 'signin'           : לא מחובר -> משפך הכניסה האינליין (נשאר כפי שהוא).
 * - 'redirect-admin'   : בעלים מחובר עם עסק קיים -> הפניה ל-/admin.
 * - 'another-identity' : בעלים מחובר שביקש במפורש עסק נוסף (another=1) -> מסך זהות אחרת.
 * - 'create'           : מחובר בלי עסק כלל -> טופס פתיחת עסק (המשך הקמה).
 */
export type NewBusinessView = 'signin' | 'redirect-admin' | 'another-identity' | 'create';

export function decideNewBusinessView(input: {
  email: string | null | undefined;
  ownedCount: number;
  another: boolean;
}): NewBusinessView {
  if (!input.email) return 'signin';
  if (input.ownedCount > 0) {
    return input.another ? 'another-identity' : 'redirect-admin';
  }
  return 'create';
}

/**
 * ה-href הראשי של קריאות הפעולה בדף הבית (hero/תמחור/סיום).
 * מחושב פעם אחת ומשמש בכל המקומות כדי שבעלים חוזר לעולם לא יישלח לטופס ההקמה.
 */
export function ownerPrimaryHref(isReturningOwner: boolean): string {
  return isReturningOwner ? OWNER_ADMIN_HREF : NEW_BUSINESS_HREF;
}

/**
 * התווית הראשית: בעלים חוזר רואה "לאזור הניהול שלי", אחרת התווית המקורית של המיקום
 * (למשל "התחילו עכשיו" ב-hero, או תווית התוכנית בכרטיס התמחור).
 */
export function ownerPrimaryLabel(isReturningOwner: boolean, guestLabel: string): string {
  return isReturningOwner ? t.marketing.hero.ownerCta : guestLabel;
}

export type HomeHeroCta = {
  primaryHref: string;
  primaryLabel: string;
  /** פעולה משנית: לבעלים חוזר "פתיחת עסק נוסף", לאורח "התחברות לעסק קיים". */
  secondaryHref: string;
  secondaryLabel: string;
};

/**
 * תצורת שורת ה-CTA הראשית ב-hero של דף הבית, מודעת למצב ההתחברות.
 * - בעלים חוזר: ראשי "לאזור הניהול שלי" -> /admin, משני "פתיחת עסק נוסף" -> ?another=1.
 * - אורח/מחובר-בלי-עסק: ראשי "הרשמה" -> /business/new, משני "התחברות לעסק קיים" -> /business/resume.
 */
export function homeHeroCta(isReturningOwner: boolean): HomeHeroCta {
  const m = t.marketing;
  if (isReturningOwner) {
    return {
      primaryHref: OWNER_ADMIN_HREF,
      primaryLabel: m.hero.ownerCta,
      secondaryHref: ADDITIONAL_BUSINESS_HREF,
      secondaryLabel: m.hero.ownerSecondaryCta,
    };
  }
  return {
    primaryHref: NEW_BUSINESS_HREF,
    primaryLabel: m.hero.primaryCta,
    secondaryHref: OWNER_LOGIN_HREF,
    // תווית ייעודית ל-hero. לא m.nav.login כדי לא לשנות את קישור ההתחברות בניווט העליון.
    secondaryLabel: m.hero.guestSecondaryCta,
  };
}
