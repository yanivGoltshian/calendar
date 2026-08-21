import { getFirstBusiness, getBusinessesOwnedByEmail } from '@/server/repos/business';
import { auth } from '@/auth';
import { buildMetadata } from '@/lib/seo';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { Navbar, Footer, Container, Section, Button, Card, Badge } from '@/components/ui';
import { Reveal, Stagger, StaggerItem, FadeIn } from '@/components/motion';
import { HeroVisual } from '@/components/landing/HeroVisual';
import { FaqAccordion } from '@/components/landing/FaqAccordion';
import { MascotTip } from '@/components/landing/MascotTip';
import { AudienceSpotlight } from '@/components/landing/AudienceSpotlight';
import { audienceIcons, featureIcons, SparkleIcon } from '@/components/landing/icons';
import { ContactBlock } from '@/components/billing/ContactBlock';
import Image from 'next/image';
import InstallApp from '@/components/pwa/InstallApp';
import { homeHeroCta, ownerPrimaryHref, ownerPrimaryLabel } from './business/ownerRouting';

const m = t.marketing;

// קריאת auth() קוראת עוגיות והופכת את הדף לדינמי. זה מקובל: הדף צריך לדעת אם
// המבקר הוא בעלים חוזר כדי לכוון אותו לאזור הניהול במקום לטופס ההקמה.
export const dynamic = 'force-dynamic';

export const metadata = buildMetadata({
  title: `תוכנה לזימון תורים וניהול עסק · ${BRAND.name}`,
  path: '/',
});

const trustStats = Object.values(m.trust.stats);

export default async function HomePage() {
  const business = await getFirstBusiness();
  const demoSlug = business?.slug;
  const demoHref = demoSlug ? `/b/${demoSlug}` : undefined;
  // כפתורי ההדגמה בדף הבית מפנים לבוחר /demo (סטנדרט מול פרימיום) במקום לעמוד יחיד.
  // ה-gate על demoHref נשמר: הבוחר מוצג רק כשקיים עסק הדגמה.
  const chooserHref = '/demo';

  // זיהוי בעלים חוזר: תמיד לגזור מ-session?.user?.email קודם, ואז לשלוף את העסקים
  // של אותו email. לא להשתמש ב-getActiveBusiness לזיהוי כי הוא נופל ל-getFirstBusiness
  // עבור אורחים ומחזיר עסק שרירותי (איתות שגוי של "בעלים חוזר").
  const session = await auth();
  const ownerEmail = session?.user?.email;
  const owned = ownerEmail ? await getBusinessesOwnedByEmail(ownerEmail) : [];
  const isReturningOwner = owned.length > 0;
  const heroCta = homeHeroCta(isReturningOwner);
  const ctaPrimaryHref = ownerPrimaryHref(isReturningOwner);

  const spotlightAudiences = ['barber', 'nails'];
  const gridAudiences = Object.entries(m.audiences.items).filter(
    ([key]) => !spotlightAudiences.includes(key),
  );
  const features = Object.entries(m.features.items);
  const steps = Object.values(m.howItWorks.steps);
  const faqItems = Object.values(m.faq.items);

  // תמחור חדש (D5): חודש ניסיון חינם ואז שתי חבילות ללא מחיר מספרי, עם פנייה אישית.
  // קבלת הצעת מחיר זמינה לכולם דרך המסלול הציבורי /quote, כדי שגם מנהל הפלטפורמה
  // (שהוא גם בעל עסק חוזר) לא ינותב אל /admin/upgrade ומשם אל /superadmin ולעולם
  // לא יגיע לטופס. הכרטיסים של Standard/Premium מפנים תמיד אל /quote?plan=X.
  const q = t.quote.home;
  const upgradeHref = (plan: 'STANDARD' | 'PREMIUM') => `/quote?plan=${plan}`;
  const upgradeLabel = q.ctaLoggedIn;

  return (
    <div className="flex min-h-screen flex-col bg-sand-50 text-sand-900 dark:bg-sand-950 dark:text-sand-50">
      <Navbar demoSlug={demoSlug} />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-radial-glow" />
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-[0.05]" />
          <Container className="grid items-center gap-14 py-8 sm:py-12 lg:grid-cols-2 lg:gap-10 lg:py-16">
            <div className="text-center lg:text-start">
              <FadeIn>
                <div className="mb-6 flex items-center justify-center">
                  <Image
                    src="/brand/torchick-emblem-mark.png"
                    alt="תור צ׳יק"
                    width={112}
                    height={112}
                    priority
                    className="h-20 w-20 object-contain sm:h-24 sm:w-24"
                  />
                </div>
              </FadeIn>
              <FadeIn>
                <Badge tone="brand" className="mb-5">
                  <span className="inline-flex items-center gap-1.5">
                    <SparkleIcon aria-hidden className="h-3.5 w-3.5" />
                    {m.hero.badge}
                  </span>
                </Badge>
              </FadeIn>
              <Reveal>
                {/*
                  וריאנט כותרת ל-A/B — יניב בוחר כיוון:
                  ראשי (פעיל):  m.hero.title / m.hero.titleAccent / m.hero.subtitle
                  חלופי:        m.hero.altTitle / m.hero.altTitleAccent / m.hero.altSubtitle
                  להחלפה: החלף את שלושת ה-m.hero.* למטה ב-m.hero.alt* המקבילים.
                */}
                <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-sand-900 dark:text-sand-50 sm:text-5xl lg:text-display-lg">
                  {m.hero.title}{' '}
                  <span className="text-gradient">{m.hero.titleAccent}</span>
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-sand-600 dark:text-sand-300 lg:mx-0">
                  {m.hero.subtitle}
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <Button href={heroCta.primaryHref} size="lg" className="w-full sm:w-auto">
                    {heroCta.primaryLabel}
                  </Button>
                  <Button
                    href={heroCta.secondaryHref}
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    {heroCta.secondaryLabel}
                  </Button>
                  {demoHref && (
                    <Button href={chooserHref} variant="ghost" size="lg" className="w-full sm:w-auto">
                      {m.hero.secondaryCta}
                    </Button>
                  )}
                </div>
              </Reveal>
              <Reveal delay={0.3}>
                <p className="mt-5 text-sm text-sand-500">{m.hero.microcopy}</p>
              </Reveal>
            </div>
            <FadeIn delay={0.15}>
              <HeroVisual />
            </FadeIn>
          </Container>
        </section>

        {/* TRUST STRIP */}
        <section className="border-y border-sand-200/70 bg-white/60 dark:border-sand-800/70 dark:bg-sand-900/40">
          <Container className="py-10">
            <Reveal>
              <p className="mb-8 text-center text-sm font-medium uppercase tracking-wider text-sand-500">
                {m.trust.title}
              </p>
            </Reveal>
            <Stagger className="grid grid-cols-2 gap-6 sm:grid-cols-4" gap={0.08}>
              {trustStats.map((stat) => (
                <StaggerItem key={stat.label} className="text-center">
                  <div className="font-display text-3xl font-bold text-gradient sm:text-4xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-sand-600 dark:text-sand-400">{stat.label}</div>
                </StaggerItem>
              ))}
            </Stagger>
          </Container>
        </section>

        {/* AUDIENCES */}
        <Section id="audiences">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge tone="accent" className="mb-4">{m.nav.audiences}</Badge>
              <h2 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
                {m.audiences.title}
              </h2>
              <p className="mt-4 text-lg text-sand-600 dark:text-sand-300">{m.audiences.subtitle}</p>
            </Reveal>
            <Stagger className="mt-12 grid gap-6 sm:grid-cols-2">
              <StaggerItem>
                <AudienceSpotlight
                  src="/brand/mascots/adam-34.png"
                  alt={m.mascots.barberAudienceAlt}
                  width={375}
                  height={863}
                  label={m.audiences.spotlight.barber.label}
                  desc={m.audiences.spotlight.barber.desc}
                />
              </StaggerItem>
              <StaggerItem>
                <AudienceSpotlight
                  src="/brand/mascots/maya-34.png"
                  alt={m.mascots.nailsAudienceAlt}
                  width={366}
                  height={936}
                  label={m.audiences.spotlight.nails.label}
                  desc={m.audiences.spotlight.nails.desc}
                />
              </StaggerItem>
            </Stagger>
            <Stagger
              className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
              gap={0.05}
            >
              {gridAudiences.map(([key, label]) => {
                const Icon = audienceIcons[key] ?? SparkleIcon;
                return (
                  <StaggerItem key={key}>
                    <Card interactive className="flex h-full flex-col items-center justify-center gap-2.5 p-5 text-center">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                        <Icon aria-hidden className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-semibold text-sand-800 dark:text-sand-100">{label}</span>
                    </Card>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </Container>
        </Section>

        {/* FEATURES */}
        <Section id="features" className="bg-sand-100/50 dark:bg-sand-900/30">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge tone="brand" className="mb-4">{m.nav.features}</Badge>
              <h2 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
                {m.features.title}
              </h2>
              <p className="mt-4 text-lg text-sand-600 dark:text-sand-300">{m.features.subtitle}</p>
            </Reveal>
            <Stagger className="mt-12 grid gap-6 sm:grid-cols-2" gap={0.1}>
              {features.map(([key, feat]) => {
                const Icon = featureIcons[key] ?? SparkleIcon;
                return (
                  <StaggerItem key={key}>
                    <Card interactive className="flex h-full flex-col gap-4 p-8">
                      <span
                        className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient shadow-glow-soft"
                        aria-hidden
                      >
                        <Icon className="h-7 w-7 text-white" />
                      </span>
                      <h3 className="font-display text-xl font-bold text-sand-900 dark:text-sand-50">
                        {feat.title}
                      </h3>
                      <p className="leading-relaxed text-sand-600 dark:text-sand-300">{feat.desc}</p>
                    </Card>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </Container>
        </Section>

        {/* HOW IT WORKS */}
        <Section id="how-it-works">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge tone="accent" className="mb-4">{m.nav.howItWorks}</Badge>
              <h2 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
                {m.howItWorks.title}
              </h2>
              <p className="mt-4 text-lg text-sand-600 dark:text-sand-300">{m.howItWorks.subtitle}</p>
            </Reveal>
            <Stagger className="mt-14 grid gap-8 sm:grid-cols-3" gap={0.12}>
              {steps.map((step, i) => (
                <StaggerItem key={i} className="relative text-center">
                  <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-gradient font-display text-2xl font-bold text-white shadow-glow-soft">
                    {i + 1}
                  </div>
                  <h3 className="font-display text-xl font-bold text-sand-900 dark:text-sand-50">
                    {step.title}
                  </h3>
                  <p className="mx-auto mt-3 max-w-xs leading-relaxed text-sand-600 dark:text-sand-300">
                    {step.desc}
                  </p>
                </StaggerItem>
              ))}
            </Stagger>
            <Reveal delay={0.15}>
              <MascotTip text={m.howItWorks.tip} className="mt-14" />
            </Reveal>
          </Container>
        </Section>

        <Section id="pricing" className="bg-sand-100/50 dark:bg-sand-900/30">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge tone="brand" className="mb-4">{m.nav.pricing}</Badge>
              <h2 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
                {q.title}
              </h2>
              <p className="mt-4 text-lg text-sand-600 dark:text-sand-300">{q.subtitle}</p>
            </Reveal>
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-3">
              {/* חודש ניסיון חינם עם כל היכולות */}
              <Reveal direction="up">
                <Card className="relative flex h-full flex-col border-brand-300 shadow-elevated ring-2 ring-brand-500/40 dark:border-brand-700">
                  <span className="absolute -top-3 start-8 rounded-full bg-brand-gradient px-4 py-1 text-xs font-bold text-white shadow-glow-soft">
                    {q.trial.badge}
                  </span>
                  <div className="mb-1 font-display text-lg font-bold text-sand-900 dark:text-sand-50">
                    {q.trial.name}
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-sand-600 dark:text-sand-300">
                    {q.trial.tagline}
                  </p>
                  <ul className="mb-8 space-y-3 text-sm">
                    {q.trial.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5 text-sand-700 dark:text-sand-200">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-xs text-brand-700 dark:bg-brand-950/60 dark:text-brand-200" aria-hidden>
                          ✓
                        </span>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    <Button href={ctaPrimaryHref} variant="primary" size="lg" className="w-full">
                      {ownerPrimaryLabel(isReturningOwner, q.ctaGuest)}
                    </Button>
                  </div>
                </Card>
              </Reveal>

              {/* שתי החבילות המתקדמות — ללא מחיר מספרי, פנייה אישית */}
              {(['standard', 'premium'] as const).map((key) => {
                const plan = q[key];
                const planCode = key === 'premium' ? 'PREMIUM' : 'STANDARD';
                return (
                  <Reveal key={key} direction="up">
                    <Card className="relative flex h-full flex-col">
                      <div className="mb-1 font-display text-lg font-bold text-sand-900 dark:text-sand-50">
                        {plan.name}
                      </div>
                      <div className="mb-3">
                        <span className="inline-block rounded-full bg-sand-900 px-3 py-1 text-xs font-semibold text-brand-100 dark:bg-sand-100 dark:text-sand-900">
                          {plan.price}
                        </span>
                      </div>
                      <p className="mb-6 text-sm leading-relaxed text-sand-600 dark:text-sand-300">
                        {plan.tagline}
                      </p>
                      <ul className="mb-8 space-y-3 text-sm">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5 text-sand-700 dark:text-sand-200">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 text-xs text-brand-700 dark:bg-brand-950/60 dark:text-brand-200" aria-hidden>
                              ✓
                            </span>
                            {feat}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-auto">
                        <Button
                          href={upgradeHref(planCode)}
                          variant="secondary"
                          size="lg"
                          className="w-full"
                        >
                          {upgradeLabel}
                        </Button>
                      </div>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
            <Reveal>
              <p className="mt-8 text-center text-sm text-sand-500">{q.footnote}</p>
            </Reveal>
            <Reveal direction="up">
              <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-sand-200 bg-white/70 p-6 shadow-sm dark:border-sand-800 dark:bg-sand-950/40 sm:p-8">
                <ContactBlock className="text-center sm:text-start" />
              </div>
            </Reveal>
          </Container>
        </Section>

        {/* FAQ */}
        <Section id="faq" className="bg-sand-100/50 dark:bg-sand-900/30">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge tone="brand" className="mb-4">{m.nav.faq}</Badge>
              <h2 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
                {m.faq.title}
              </h2>
              <p className="mt-4 text-lg text-sand-600 dark:text-sand-300">{m.faq.subtitle}</p>
            </Reveal>
            <div className="mt-12">
              <FaqAccordion items={faqItems} />
            </div>
          </Container>
        </Section>

        {/* FINAL CTA */}
        <Section>
          <Container>
            <Reveal>
              <div className="relative overflow-hidden rounded-5xl bg-brand-sheen px-6 py-16 text-center shadow-elevated sm:px-12 sm:py-20">
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
                <Image
                  src="/brand/mascots/maya-34.png"
                  alt={m.mascots.ctaAlt}
                  width={366}
                  height={936}
                  className="pointer-events-none absolute -bottom-2 end-3 hidden h-64 w-auto drop-shadow-2xl lg:block xl:h-72"
                />
                <div className="relative mx-auto max-w-2xl">
                  <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                    {m.finalCta.title}
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">{m.finalCta.subtitle}</p>
                  <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button href={ctaPrimaryHref} variant="accent" size="lg" className="w-full sm:w-auto">
                      {ownerPrimaryLabel(isReturningOwner, m.finalCta.primaryCta)}
                    </Button>
                    {demoHref && (
                      <Button
                        href={chooserHref}
                        size="lg"
                        className="w-full bg-white/10 text-white ring-1 ring-inset ring-white/40 hover:bg-white/20 sm:w-auto"
                      >
                        {m.finalCta.secondaryCta}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          </Container>
        </Section>

        {/* PWA INSTALL (platform) */}
        <Section id="get-app">
          <Container>
            <Reveal>
              <div className="mx-auto max-w-2xl">
                <InstallApp variant="platform" />
              </div>
            </Reveal>
          </Container>
        </Section>
      </main>

      <Footer demoSlug={demoSlug} />
    </div>
  );
}
