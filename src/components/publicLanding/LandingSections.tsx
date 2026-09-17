import type { ReactNode } from 'react';
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
import type { PublicBusinessReview } from '@/lib/businessReviews';
import LandingFaq from './LandingFaq';
import LandingAbout from './LandingAbout';
import LandingLocation from './LandingLocation';
import LandingSocialCta from './LandingSocialCta';
import LandingInstagramEmbeds from './LandingInstagramEmbeds';
import LandingSocialVideos from './LandingSocialVideos';
import LandingFacebookFeed from './LandingFacebookFeed';
import HotDealsCube from './HotDealsCube';
import LandingBooking from './LandingBooking';
import WhatsAppFab from './WhatsAppFab';
import type { ServiceCategory } from '@/lib/serviceCategories';

type WorkingHour = { weekday: number; startMinute: number; endMinute: number };

type Props = {
  premium?: boolean;
  timeZone?: string;
  content: LandingContent | null;
  type: string | null;
  services: LandingService[];
  categories?: ServiceCategory[];
  staff: { id: string; displayName: string }[];
  businessName: string;
  slug: string;
  workingHours: WorkingHour[];
  address?: string | null;
  phone?: string | null;
  bookHref: string;
  iconKey: SectionIconKey;
  // מקטע "שלום .." ללקוח מזוהה — מוזרק בין ווידג'ט קביעת התור למקטע המבצעים.
  returning?: ReactNode;
  platformReviews?: PublicBusinessReview[];
  reviewSubmitHref?: string;
};

// מנצח המקטעים של עמוד הנחיתה — מרנדר את המקטעים (מלבד ההירו) בסדר שנפתר
// מ-resolveLandingSections, תוך כיבוד מתגי הבעלים ושמירה על מקטעים תלויי-נתונים.
export default function LandingSections({
  premium,
  timeZone = 'Asia/Jerusalem',
  content,
  type,
  services,
  categories,
  staff,
  businessName,
  slug,
  workingHours,
  address,
  phone,
  bookHref,
  iconKey,
  returning,
  platformReviews = [],
  reviewSubmitHref,
}: Props) {
  const sections = resolveLandingSections({ content, type, reviewSubmissionAvailable: Boolean(reviewSubmitHref) }).filter((s) => s !== 'hero');
  const defaults = landingDefaults(type);
  const l = t.publicPage.landing;
  const eyebrows = t.premiumLanding.sectionEyebrow;

  const benefits = content?.benefits?.length ? content.benefits : defaults.benefits;
  const whatsapp = content?.socialLinks?.whatsapp?.trim();
  // בחירת הפריסה משותפת לכותרת ולמקטעים; זיהוי לפי הצעות נשמר לקוראים ותיקים.
  const isClinicPremium = premium ?? Boolean(content?.launchOffer || content?.hotDeals);
  const clinic = t.premiumLanding.clinic;

  return (
    <>
      {/* ווידג'ט קביעת תור אינליין — חלון ראווה יוקרתי במרכז העמוד, מוצג רק בפרימיום.
          הבחירה מודגמת כאן והאישור הסופי מתבצע באשף קביעת התור המאובטח. */}
      {isClinicPremium && services.length > 0 ? (
        <LandingBooking
          timeZone={timeZone}
          slug={slug}
          services={services}
          categories={categories}
          staff={staff}
          bookHref={bookHref}
          labels={clinic.booking}
        />
      ) : null}
      {/* מקטע "שלום .." ללקוח מזוהה — בין ווידג'ט קביעת התור למבצעים (סדר המוקאפ). */}
      {isClinicPremium ? returning : null}
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
              <LandingHighlights
                key={section}
                eyebrow={eyebrows.highlights}
                title={l.highlightsTitle}
                benefits={benefits}
              />
            );
          case 'services':
            if (services.length === 0) return null;
            return (
              <LandingServices
                key={section}
                eyebrow={eyebrows.services}
                title={t.publicPage.servicesTitle}
                services={services}
                categories={categories}
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
                title={l.testimonialsTitle}
                items={content?.testimonials ?? []}
                platformReviews={platformReviews}
                submitHref={reviewSubmitHref}
                googleReviewsUrl={content?.googleReviewsUrl}
                googleLabel={l.googleReviewsLabel}
                googleCta={l.googleReviewsCta}
                googleEmptyText={l.googleReviewsEmpty}
              />
            );
          case 'faq':
            return (
              <LandingFaq
                key={section}
                eyebrow={eyebrows.faq}
                title={l.faqTitle}
                items={content?.faq ?? []}
              />
            );
          case 'about':
            return (
              <LandingAbout
                key={section}
                eyebrow={eyebrows.about}
                title={l.aboutTitle}
                text={content?.about ?? ''}
              />
            );
          case 'location':
            return (
              <LandingLocation
                key={section}
                eyebrow={eyebrows.location}
                title={l.locationTitle}
                workingHours={workingHours}
                weekdays={t.publicPage.weekdays}
                closedLabel={t.publicPage.hoursClosed}
                address={address}
                phone={phone}
                email={content?.contact?.email}
                websiteUrl={content?.contact?.websiteUrl}
                sourceMapUrl={content?.contact?.mapUrl}
                directionsCta={l.directionsCta}
                callCta={isClinicPremium ? clinic.location.callCta : l.callCta}
                {...(isClinicPremium
                  ? {
                      mapsCta: clinic.location.mapsCta,
                      wazeCta: clinic.location.wazeCta,
                      whatsappCta: clinic.location.whatsappCta,
                      whatsapp: content?.socialLinks?.whatsapp ?? null,
                      phoneLabel: clinic.location.phoneLabel,
                      contactCta: clinic.location.contactCta,
                      navTitle: clinic.location.navTitle,
                      mapTitle: `מפת הגעה אל ${businessName}`,
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
                labels={{
                  whatsapp: l.whatsapp,
                  instagram: l.instagram,
                  facebook: l.facebook,
                  tiktok: l.tiktok,
                }}
              />
            );
          default:
            return null;
        }
      })}
      {/* הטמעות חברתיות רשמיות — כל בלוק נשען על נוכחות נתונים בלבד (self-gated),
          לכן עסק בלי קישורים אלה לא מרנדר דבר. ממוקמים ליד הקריאה לפעולה החברתית. */}
      {content?.instagramPostUrls?.length ? (
        <LandingInstagramEmbeds
          eyebrow={eyebrows.instagram}
          title={l.instagramTitle}
          urls={content.instagramPostUrls}
        />
      ) : null}
      {content?.socialVideoUrls?.length ? (
        <LandingSocialVideos
          eyebrow={eyebrows.socialVideos}
          title={l.socialVideosTitle}
          urls={content.socialVideoUrls}
        />
      ) : null}
      {content?.facebookFeedUrl ? (
        <LandingFacebookFeed
          eyebrow={eyebrows.facebook}
          title={l.facebookTitle}
          pageUrl={content.facebookFeedUrl}
        />
      ) : null}
      {whatsapp ? (
        <WhatsAppFab
          href={socialHref('whatsapp', whatsapp)}
          ariaLabel={t.premiumLanding.whatsappAria}
        />
      ) : null}
    </>
  );
}
