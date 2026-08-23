import { t } from '@/i18n';
import {
  resolveLandingSections,
  landingDefaults,
  type LandingContent,
  type SectionIconKey,
} from '@/lib/publicPageStyle';
import { socialHref } from '@/lib/socialLinks';
import LandingHighlights from './LandingHighlights';
import LandingServices, { type LandingService } from './LandingServices';
import LandingGallery from './LandingGallery';
import LandingBeforeAfter from './LandingBeforeAfter';
import LandingTestimonials from './LandingTestimonials';
import LandingFaq from './LandingFaq';
import LandingAbout from './LandingAbout';
import LandingLocation from './LandingLocation';
import LandingSocialCta from './LandingSocialCta';
import HotDealsCube from './HotDealsCube';
import LandingBooking from './LandingBooking';
import WhatsAppFab from './WhatsAppFab';

type WorkingHour = { weekday: number; startMinute: number; endMinute: number };

type Props = {
  content: LandingContent | null;
  type: string | null;
  services: LandingService[];
  staff: { id: string; displayName: string }[];
  slug: string;
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
  staff,
  slug,
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
  const eyebrows = t.premiumLanding.sectionEyebrow;

  const benefits = content?.benefits?.length ? content.benefits : defaults.benefits;
  const whatsapp = content?.socialLinks?.whatsapp?.trim();
  // עמוד פרימיום של קליניקה מזוהה לפי נוכחות launchOffer או hotDeals; רק אז
  // מוזרקים מקטע הקובייה האינליין ומצב המפה הפרימיום למקטע המיקום.
  const isClinicPremium = Boolean(content?.launchOffer || content?.hotDeals);
  const clinic = t.premiumLanding.clinic;

  return (
    <>
      {/* ווידג'ט קביעת תור אינליין — חלון ראווה יוקרתי במרכז העמוד, מוצג רק בפרימיום.
          הבחירה מודגמת כאן והאישור הסופי מתבצע באשף קביעת התור המאובטח. */}
      {isClinicPremium && services.length > 0 ? (
        <LandingBooking slug={slug} services={services} staff={staff} bookHref={bookHref} labels={clinic.booking} />
      ) : null}
      {/* מבצעים חמים — קובייה כהה מיד אחרי ווידג'ט קביעת התור, לפני שאר המקטעים,
          בהתאם לסדר המוקאפ המאושר (הירו → קביעת תור → מבצעים → שאר המקטעים). */}
      {isClinicPremium && content?.hotDeals ? (
        <HotDealsCube
          eyebrow={content.hotDeals.eyebrow}
          title={content.hotDeals.title ?? clinic.navOffers}
          text={content.hotDeals.text}
          ctaLabel={content.hotDeals.ctaLabel ?? l.bookService}
          ctaHref={bookHref}
          images={content.hotDeals.images}
        />
      ) : null}
      {sections.map((section) => {
        switch (section) {
          case 'highlights':
            return (
              <LandingHighlights key={section} eyebrow={eyebrows.highlights} title={l.highlightsTitle} benefits={benefits} />
            );
          case 'services':
            if (services.length === 0) return null;
            return (
              <LandingServices
                key={section}
                eyebrow={eyebrows.services}
                lede={t.premiumLanding.servicesLede}
                title={t.publicPage.servicesTitle}
                services={services}
                bookHref={bookHref}
                iconKey={iconKey}
                bookLabel={l.bookService}
              />
            );
          case 'gallery':
            return (
              <LandingGallery
                key={section}
                eyebrow={eyebrows.gallery}
                title={l.galleryTitle}
                images={content?.galleryImageUrls ?? []}
              />
            );
          case 'beforeAfter':
            return (
              <LandingBeforeAfter
                key={section}
                eyebrow={eyebrows.beforeAfter}
                title={l.beforeAfterTitle}
                items={content?.beforeAfter ?? []}
                beforeLabel={l.beforeLabel}
                afterLabel={l.afterLabel}
                hint={l.beforeAfterHint}
              />
            );
          case 'testimonials':
            return (
              <LandingTestimonials
                key={section}
                eyebrow={eyebrows.testimonials}
                title={l.testimonialsTitle}
                items={content?.testimonials ?? []}
                googleReviewsUrl={content?.googleReviewsUrl}
                googleLabel={l.googleReviewsLabel}
                googleCta={l.googleReviewsCta}
              />
            );
          case 'faq':
            return <LandingFaq key={section} eyebrow={eyebrows.faq} title={l.faqTitle} items={content?.faq ?? []} />;
          case 'about':
            return <LandingAbout key={section} eyebrow={eyebrows.about} title={l.aboutTitle} text={content?.about ?? ''} />;
          case 'location':
            return (
              <LandingLocation
                key={section}
                eyebrow={eyebrows.location}
                title={l.locationTitle}
                workingHours={workingHours}
                weekdays={t.publicPage.weekdays}
                closedLabel={t.publicPage.hoursClosed}
                todayIdx={todayIdx}
                address={address}
                phone={phone}
                directionsCta={l.directionsCta}
                callCta={l.callCta}
                {...(isClinicPremium
                  ? {
                      mapsCta: clinic.location.mapsCta,
                      wazeCta: clinic.location.wazeCta,
                      whatsappCta: clinic.location.whatsappCta,
                      whatsapp: content?.socialLinks?.whatsapp ?? null,
                      contactCta: clinic.location.contactCta,
                      navTitle: clinic.location.navTitle,
                      mapTitle: clinic.location.mapTitle,
                    }
                  : {})}
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
      {whatsapp ? (
        <WhatsAppFab href={socialHref('whatsapp', whatsapp)} ariaLabel={t.premiumLanding.whatsappAria} />
      ) : null}
    </>
  );
}
