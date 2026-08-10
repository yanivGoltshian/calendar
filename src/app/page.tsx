import { getFirstBusiness } from '@/server/repos/business';
import { buildMetadata } from '@/lib/seo';
import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { Navbar, Footer, Container, Section, Button, Card, Badge } from '@/components/ui';
import { Reveal, Stagger, StaggerItem, FadeIn } from '@/components/motion';
import { HeroVisual } from '@/components/landing/HeroVisual';
import { FaqAccordion } from '@/components/landing/FaqAccordion';

const m = t.marketing;

export const metadata = buildMetadata({
  title: `תוכנה לזימון תורים וניהול עסק · ${BRAND.name}`,
  ogTitle: 'תוכנה לזימון תורים וניהול עסק',
  path: '/',
});

const audienceIcons: Record<string, string> = {
  hair: '✂️',
  barber: '💈',
  cosmetics: '💆',
  beauty: '💄',
  nails: '💅',
  trainers: '🏋️',
  dogs: '🐩',
  more: '✨',
};

const featureIcons: Record<string, string> = {
  booking: '🗓️',
  calendar: '📅',
  reminders: '🔔',
  page: '🎨',
};

const trustStats = [
  { value: '+50,000', label: m.trust.stats.bookings },
  { value: '+300', label: m.trust.stats.businesses },
  { value: '24/7', label: m.trust.stats.availability },
  { value: '4.9', label: m.trust.stats.rating },
];

export default async function HomePage() {
  const business = await getFirstBusiness();
  const demoSlug = business?.slug;
  const demoHref = demoSlug ? `/b/${demoSlug}` : undefined;

  const audiences = Object.entries(m.audiences.items);
  const features = Object.entries(m.features.items);
  const steps = Object.values(m.howItWorks.steps);
  const plans = [
    { ...m.pricing.plans.free, popular: false },
    { ...m.pricing.plans.pro, popular: true },
  ];
  const testimonials = Object.values(m.testimonials.items);
  const faqItems = Object.values(m.faq.items);

  return (
    <div className="flex min-h-screen flex-col bg-sand-50 text-sand-900 dark:bg-sand-950 dark:text-sand-50">
      <Navbar demoSlug={demoSlug} />

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-radial-glow" />
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-[0.05]" />
          <Container className="grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-2 lg:gap-10 lg:py-32">
            <div className="text-center lg:text-start">
              <FadeIn>
                <Badge tone="brand" className="mb-5">✦ {m.hero.badge}</Badge>
              </FadeIn>
              <Reveal>
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
                  <Button href="/admin" size="lg" className="w-full sm:w-auto">
                    {m.hero.primaryCta}
                  </Button>
                  {demoHref && (
                    <Button href={demoHref} variant="secondary" size="lg" className="w-full sm:w-auto">
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
            <Stagger className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" gap={0.06}>
              {audiences.map(([key, label]) => (
                <StaggerItem key={key}>
                  <Card interactive className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <span className="text-4xl" aria-hidden>{audienceIcons[key] ?? '✨'}</span>
                    <span className="font-semibold text-sand-800 dark:text-sand-100">{label}</span>
                  </Card>
                </StaggerItem>
              ))}
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
              {features.map(([key, feat]) => (
                <StaggerItem key={key}>
                  <Card interactive className="flex h-full flex-col gap-4 p-8">
                    <span
                      className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-2xl shadow-glow-soft"
                      aria-hidden
                    >
                      {featureIcons[key] ?? '✨'}
                    </span>
                    <h3 className="font-display text-xl font-bold text-sand-900 dark:text-sand-50">
                      {feat.title}
                    </h3>
                    <p className="leading-relaxed text-sand-600 dark:text-sand-300">{feat.desc}</p>
                  </Card>
                </StaggerItem>
              ))}
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
          </Container>
        </Section>

        {/* PRICING */}
        <Section id="pricing" className="bg-sand-100/50 dark:bg-sand-900/30">
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge tone="brand" className="mb-4">{m.nav.pricing}</Badge>
              <h2 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
                {m.pricing.title}
              </h2>
              <p className="mt-4 text-lg text-sand-600 dark:text-sand-300">{m.pricing.subtitle}</p>
            </Reveal>
            <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
              {plans.map((plan) => (
                <Reveal key={plan.name} direction="up">
                  <Card
                    className={
                      plan.popular
                        ? 'relative flex h-full flex-col border-brand-300 shadow-elevated ring-2 ring-brand-500/40 dark:border-brand-700'
                        : 'relative flex h-full flex-col'
                    }
                  >
                    {plan.popular && (
                      <span className="absolute -top-3 start-8 rounded-full bg-brand-gradient px-4 py-1 text-xs font-bold text-white shadow-glow-soft">
                        {m.pricing.popular}
                      </span>
                    )}
                    <div className="mb-1 font-display text-lg font-bold text-sand-900 dark:text-sand-50">
                      {plan.name}
                    </div>
                    <div className="mb-3 flex items-baseline gap-1">
                      <span className="font-display text-4xl font-bold text-sand-900 dark:text-sand-50">
                        {plan.price}
                      </span>
                      {plan.price.includes('₪') && (
                        <span className="text-sm text-sand-500">{m.pricing.monthlySuffix}</span>
                      )}
                    </div>
                    <p className="mb-6 text-sm leading-relaxed text-sand-600 dark:text-sand-300">
                      {plan.desc}
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
                        href="/admin"
                        variant={plan.popular ? 'primary' : 'secondary'}
                        size="lg"
                        className="w-full"
                      >
                        {plan.cta}
                      </Button>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <p className="mt-8 text-center text-sm text-sand-500">{m.pricing.note}</p>
            </Reveal>
          </Container>
        </Section>

        {/* TESTIMONIALS */}
        <Section>
          <Container>
            <Reveal className="mx-auto max-w-2xl text-center">
              <Badge tone="accent" className="mb-4">{m.testimonials.title}</Badge>
              <h2 className="font-display text-3xl font-bold text-sand-900 dark:text-sand-50 sm:text-4xl">
                {m.testimonials.subtitle}
              </h2>
            </Reveal>
            <Stagger className="mt-12 grid gap-6 lg:grid-cols-3" gap={0.1}>
              {testimonials.map((item, i) => (
                <StaggerItem key={i}>
                  <Card className="flex h-full flex-col gap-4 p-8">
                    <div className="text-lg text-accent-400" aria-hidden>★★★★★</div>
                    <p className="flex-1 text-lg leading-relaxed text-sand-700 dark:text-sand-200">
                      “{item.quote}”
                    </p>
                    <div className="flex items-center gap-3 border-t border-sand-200 pt-4 dark:border-sand-700">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-gradient font-bold text-white" aria-hidden>
                        {item.name.charAt(0)}
                      </span>
                      <div>
                        <div className="font-semibold text-sand-900 dark:text-sand-50">{item.name}</div>
                        <div className="text-sm text-sand-500">{item.role}</div>
                      </div>
                    </div>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
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
                <div className="relative mx-auto max-w-2xl">
                  <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                    {m.finalCta.title}
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">{m.finalCta.subtitle}</p>
                  <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <Button href="/admin" variant="accent" size="lg" className="w-full sm:w-auto">
                      {m.finalCta.primaryCta}
                    </Button>
                    {demoHref && (
                      <Button
                        href={demoHref}
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
      </main>

      <Footer demoSlug={demoSlug} />
    </div>
  );
}
