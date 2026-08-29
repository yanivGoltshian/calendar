import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { getActiveBusiness } from '@/server/repos/business';
import { getOrCreateSettings } from '@/server/repos/settings';
import { listServices } from '@/server/repos/services';
import { getBusinessHours } from '@/server/repos/workingHours';
import { getServiceTemplate } from '@/server/onboarding/serviceTemplates';
import { bookingUrl } from '@/lib/booking-link';
import { bookingQrSvg } from '@/lib/qr-svg';
import { normalizeLandingContent } from '@/lib/publicPageStyle';
import { resolveOnboardingEntry } from './premium';
import OnboardingWizard, { type WizardService } from './OnboardingWizard';

export const metadata: Metadata = { title: t.admin.onboarding.title };

/**
 * ‎?edit=premium‎ (או ‎?phase=editor‎) פותח את האשף ישר בעורך עמוד הפרימיום —
 * קיצור בלחיצה אחת לעריכת העמוד, למשל מיד אחרי «כניסה כבעל העסק». בנוסף, עסק
 * שכבר סיים את ההקמה הבסיסית (settings.onboardingCompleted) נוחת ישר בעורך גם בלי
 * deep-link, כדי לא לחזור על שלושת הצעדים. ‎?step=services|hours|branding‎ הוא
 * deep-link «המשך» מטבעת ההתקדמות בדשבורד — פותח את האשף ישר בצעד הבסיסי החסר
 * (ולכן גובר על כניסת העורך). ב-Next 15 ‎searchParams‎ הוא Promise ולכן נדרש await.
 */
type Props = {
  searchParams: Promise<{ edit?: string; phase?: string; step?: string }>;
};

// מיפוי deep-link ‎?step=‎ לצעד הבסיסי באשף (services→0, hours→1, branding→2).
const BASIC_STEP_PARAMS = ['services', 'hours', 'branding'] as const;
type BasicStepParam = (typeof BASIC_STEP_PARAMS)[number];
function resolveInitialBasicStep(step?: string): BasicStepParam | undefined {
  return BASIC_STEP_PARAMS.find((s) => s === step);
}

export default async function AdminOnboardingPage({ searchParams }: Props) {
  const sp = await searchParams;

  const business = await getActiveBusiness();
  if (!business) notFound();

  const settings = await getOrCreateSettings(business.id);
  const services = await listServices(business.id);
  const businessHours = await getBusinessHours(business.id);

  // «הקמה בסיסית הושלמה» נגזר מנתונים אמיתיים, במקביל לרשימת ההקמה ב-/admin
  // (שירותים + שעות + מיתוג). זה מכסה עסק שהוגדר דרך עמודי האדמין הנפרדים בלי
  // שהדגל settings.onboardingCompleted נסגר, כדי שלא יופל שוב לשלב הראשון של האשף.
  const hasBranding = Boolean(
    business.logoUrl || business.brandColor || business.coverImageUrl,
  );
  const basicSetupComplete =
    services.length > 0 && businessHours.length > 0 && hasBranding;

  // deep-link «המשך»: ‎?step=‎ פותח את האשף בצעד הבסיסי החסר וגובר על כניסת העורך
  // האוטומטית, כדי לנחות בדיוק במקום שבו חסר הפרט (ולא במסך אחר).
  const initialBasicStep = resolveInitialBasicStep(sp.step);

  // כניסה ישירה לעורך: deep-link מפורש, עסק שסגר את דגל ההקמה, או עסק שההקמה
  // הבסיסית שלו כבר מוגדרת בפועל. כאשר קיים ‎?step=‎ בסיסי — לא פותחים עורך.
  const initialPremiumPhase = initialBasicStep
    ? undefined
    : resolveOnboardingEntry({
        editParam: sp.edit,
        phaseParam: sp.phase,
        onboardingCompleted: settings.onboardingCompleted,
        basicSetupComplete,
      });

  const link = bookingUrl(business.slug);
  const qr = bookingQrSvg(link, {
    label: t.admin.onboarding.goLive.share.qrAlt.replace('{name}', business.name),
  });
  // QR נפרד לקישור ההזמנות `/b/<slug>/book` (שונה מ-QR של עמוד העסק).
  const bookQr = bookingQrSvg(`${link}/book`, {
    label: t.admin.onboarding.goLive.share.qrAlt.replace('{name}', business.name),
  });

  const wizardServices: WizardService[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    durationMin: s.durationMin,
    priceAgorot: s.priceAgorot,
    hidden: s.hidden,
  }));

  // דוגמת פלייסהולדר מותאמת לסוג העסק (למשל "אימון אישי" לעסק כושר).
  const serviceExample = getServiceTemplate(business.type)[0]?.name ?? '';

  // תוכן פרימיום קיים (אם כבר מולא) — מנורמל לזריעת האשף בכניסה חוזרת.
  const premiumInitial = normalizeLandingContent(business.landingContent);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6 lg:max-w-5xl xl:max-w-6xl">
      <header className="mb-6">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">{t.admin.onboarding.title}</h1>
        <p className="mt-1 text-sm text-[#8f8478]">{t.admin.onboarding.subtitle}</p>
      </header>

      <OnboardingWizard
        businessName={business.name}
        brandColor={business.brandColor ?? ''}
        logoUrl={business.logoUrl ?? ''}
        services={wizardServices}
        serviceExample={serviceExample}
        bookingUrl={link}
        bookingQr={qr}
        bookingBookQr={bookQr}
        businessType={business.type ?? ''}
        businessAddress={business.address ?? ''}
        slug={business.slug}
        premiumInitial={premiumInitial}
        initialBasicStep={initialBasicStep}
        initialPremiumPhase={initialPremiumPhase}
      />
    </main>
  );
}
