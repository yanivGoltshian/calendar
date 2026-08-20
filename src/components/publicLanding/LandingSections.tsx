import { t } from '@/i18n';
import {
  resolveLandingSections,
  landingDefaults,
  type LandingContent,
  type SectionIconKey,
} from '@/lib/publicPageStyle';
import LandingHighlights from './LandingHighlights';
import LandingServices, { type LandingService } from './LandingServices';
import LandingGallery from './LandingGallery';
import LandingBeforeAfter from './LandingBeforeAfter';
import LandingTestimonials from './LandingTestimonials';
import LandingFaq from './LandingFaq';
import LandingAbout from './LandingAbout';
import LandingLocation from './LandingLocation';
import LandingSocialCta from './LandingSocialCta';

type WorkingHour = { weekday: number; startMinute: number; endMinute: number };

type Props = {
  content: LandingContent | null;
  type: string | null;
  services: LandingService[];
  workingHours: WorkingHour[];
  address?: string | null;
  phone?: string | null;
  bookHref: string;
  iconKey: SectionIconKey;
  todayIdx: number;
};

// מנצח המקטעים של עמוד הנחיתה — מרנדר את המקטעים (מלבד ההירו) בסדר שנפתר
// מ-resolveLandingSections, תוך כיבוד מתגי הבעלים ושמירה על מקטעים תלויי-נתונים.
export default function LandingSections({
  content,
  type,
  services,
  workingHours,
  address,
  phone,
  bookHref,
  iconKey,
  todayIdx,
}: Props) {
  const sections = resolveLandingSections({ content, type }).filter((s) => s !== 'hero');
  const defaults = landingDefaults(type);
  const l = t.publicPage.landing;

  const benefits = content?.benefits?.length ? content.benefits : defaults.benefits;

  return (
    <>
      {sections.map((section) => {
        switch (section) {
          case 'highlights':
            return <LandingHighlights key={section} title={l.highlightsTitle} benefits={benefits} />;
          case 'services':
            if (services.length === 0) return null;
            return (
              <LandingServices
                key={section}
                title={t.publicPage.servicesTitle}
                services={services}
                bookHref={bookHref}
                iconKey={iconKey}
                bookLabel={l.bookService}
              />
            );
          case 'gallery':
            return <LandingGallery key={section} title={l.galleryTitle} images={content?.galleryImageUrls ?? []} />;
          case 'beforeAfter':
            return (
              <LandingBeforeAfter
                key={section}
                title={l.beforeAfterTitle}
                items={content?.beforeAfter ?? []}
                beforeLabel={l.beforeLabel}
                afterLabel={l.afterLabel}
                hint={l.beforeAfterHint}
              />
            );
          case 'testimonials':
            return <LandingTestimonials key={section} title={l.testimonialsTitle} items={content?.testimonials ?? []} />;
          case 'faq':
            return <LandingFaq key={section} title={l.faqTitle} items={content?.faq ?? []} />;
          case 'about':
            return <LandingAbout key={section} title={l.aboutTitle} text={content?.about ?? ''} />;
          case 'location':
            return (
              <LandingLocation
                key={section}
                title={l.locationTitle}
                workingHours={workingHours}
                weekdays={t.publicPage.weekdays}
                closedLabel={t.publicPage.hoursClosed}
                todayIdx={todayIdx}
                address={address}
                phone={phone}
                directionsCta={l.directionsCta}
                callCta={l.callCta}
              />
            );
          case 'socialCta':
            return (
              <LandingSocialCta
                key={section}
                ctaTitle={l.ctaTitle}
                ctaText={l.ctaText}
                ctaLabel={content?.ctaLabel || t.publicPage.bookCta}
                bookHref={bookHref}
                socialTitle={l.socialTitle}
                socialLinks={content?.socialLinks ?? {}}
                labels={{ whatsapp: l.whatsapp, instagram: l.instagram, facebook: l.facebook, tiktok: l.tiktok }}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
