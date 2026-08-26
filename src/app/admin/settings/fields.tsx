import type { Business, BusinessSettings } from '@prisma/client';
import { BusinessType, ReminderChannel } from '@prisma/client';
import { t } from '@/i18n';
import { BRAND } from '@/config/brand';
import { inputClass } from './fieldStyles';
import { BrandColorField } from './BrandColorField';
import { TimezoneField } from './TimezoneField';
import { ImageUploadField } from './ImageUploadField';
import {
  normalizePublicPageStyle,
  normalizeLandingContent,
  landingDefaults,
  landingSectionEnabledByDefault,
  TOGGLEABLE_LANDING_SECTIONS,
  MAX_BENEFITS,
  MAX_TESTIMONIALS,
  MAX_GALLERY_IMAGES,
  MAX_FAQ,
  MAX_BEFORE_AFTER,
} from '@/lib/publicPageStyle';

/**
 * קבוצות שדות משותפות למודול ההגדרות וההקמה.
 * רכיבים פרזנטטיביים בלבד (ללא hooks) — נטענים גם מעמוד השרת וגם מאשף הלקוח.
 */

export { inputClass };
const labelClass = 'mb-1 block text-sm font-medium text-slate-700';
const hintClass = 'mt-1 text-xs text-slate-500';
const checkRowClass = 'flex items-start gap-2 text-sm text-slate-700';
const checkboxClass =
  'mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500';

export type ProfileValues = Pick<
  Business,
  | 'name'
  | 'type'
  | 'phone'
  | 'address'
  | 'description'
  | 'instagramUrl'
  | 'logoUrl'
  | 'coverImageUrl'
  | 'brandColor'
  | 'timezone'
>;

export function ProfileFields({ b }: { b: ProfileValues }) {
  const s = t.admin.settings.profile;
  return (
    <>
      <div>
        <label className={labelClass}>{s.nameLabel}</label>
        <input
          name="name"
          required
          defaultValue={b.name ?? ''}
          placeholder={s.namePlaceholder}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>{s.typeLabel}</label>
        <select name="type" defaultValue={b.type ?? ''} className={inputClass}>
          <option value="">—</option>
          {Object.values(BusinessType).map((value) => (
            <option key={value} value={value}>
              {t.admin.settings.types[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label className={labelClass}>{s.phoneLabel}</label>
          <input
            name="phone"
            dir="ltr"
            defaultValue={b.phone ?? ''}
            placeholder={s.phonePlaceholder}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>{s.addressLabel}</label>
          <input
            name="address"
            defaultValue={b.address ?? ''}
            placeholder={s.addressPlaceholder}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>{s.descriptionLabel}</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={b.description ?? ''}
          placeholder={s.descriptionPlaceholder}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>{s.instagramLabel}</label>
        <input
          name="instagramUrl"
          dir="ltr"
          defaultValue={b.instagramUrl ?? ''}
          placeholder="https://instagram.com/…"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label className={labelClass}>{s.logoUrlLabel}</label>
          <ImageUploadField
            name="logoUrl"
            defaultValue={b.logoUrl ?? ''}
            targetAspect={1}
            rounded
            maxWidth={512}
            maxHeight={512}
            mime="image/png"
            labels={{
              choose: s.image.choose,
              change: s.image.change,
              remove: s.image.remove,
              cropTitle: s.image.cropTitle,
              zoom: s.image.zoom,
              adjust: s.image.adjust,
              done: s.image.done,
              cancel: s.image.cancel,
              dragHint: s.image.logoDragHint,
              empty: s.image.logoEmpty,
              tooLarge: s.image.tooLarge,
            }}
          />
          <p className={hintClass}>{s.logoHint}</p>
        </div>
        <div className="flex-1">
          <label className={labelClass}>{s.coverUrlLabel}</label>
          <ImageUploadField
            name="coverImageUrl"
            defaultValue={b.coverImageUrl ?? ''}
            targetAspect={16 / 9}
            rounded={false}
            maxWidth={1280}
            maxHeight={720}
            mime="image/jpeg"
            labels={{
              choose: s.image.choose,
              change: s.image.change,
              remove: s.image.remove,
              cropTitle: s.image.cropTitle,
              zoom: s.image.zoom,
              adjust: s.image.adjust,
              done: s.image.done,
              cancel: s.image.cancel,
              dragHint: s.image.coverDragHint,
              empty: s.image.coverEmpty,
              tooLarge: s.image.tooLarge,
            }}
          />
          <p className={hintClass}>{s.coverHint}</p>
        </div>
      </div>

      <div>
        <label className={labelClass}>{s.brandColorLabel}</label>
        <BrandColorField
          name="brandColor"
          defaultValue={b.brandColor ?? ''}
          fallback={BRAND.themeColor}
          resetLabel={s.brandColorReset}
          emptyLabel={s.brandColorEmpty}
        />
        <p className={hintClass}>{s.brandColorHint}</p>
      </div>

      <div>
        <label className={labelClass}>{s.timezoneLabel}</label>
        <TimezoneField
          name="timezone"
          defaultValue={b.timezone ?? 'Asia/Jerusalem'}
          searchPlaceholder={s.timezoneSearchPlaceholder}
          selectedLabel={s.timezoneSelected}
          noResultsLabel={s.timezoneNoResults}
        />
      </div>
    </>
  );
}

export type PublicPageValues = Pick<Business, 'type' | 'publicPageStyle' | 'landingContent'>;

/**
 * בחירת סגנון העמוד הציבורי (הזמנה מול נחיתה) ועורך תוכן עמוד הנחיתה.
 * רכיב פרזנטטיבי בלבד; עורך הנחיתה מוצג תמיד ורלוונטי כשנבחר "עמוד נחיתה".
 * שדות ריקים נופלים לברירת מחדל לפי סוג העסק בעת ההצגה בפועל.
 */
export function PublicPageFields({
  b,
  hideStyleChoice = false,
  hideHero = false,
  hideSections = false,
}: {
  b: PublicPageValues;
  hideStyleChoice?: boolean;
  hideHero?: boolean;
  hideSections?: boolean;
}) {
  const s = t.admin.settings.pageStyle;
  const img = t.admin.settings.profile.image;
  const style = normalizePublicPageStyle(b.publicPageStyle);
  const lc = normalizeLandingContent(b.landingContent) ?? {};
  const defaults = landingDefaults(b.type);
  const galleryLabels = {
    choose: img.choose,
    change: img.change,
    remove: img.remove,
    cropTitle: img.cropTitle,
    zoom: img.zoom,
    adjust: img.adjust,
    done: img.done,
    cancel: img.cancel,
    dragHint: img.coverDragHint,
    empty: img.coverEmpty,
    tooLarge: img.tooLarge,
  };

  const styleOption = (
    value: 'BOOKING' | 'LANDING',
    label: string,
    hint: string,
  ) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/60">
      <input
        type="radio"
        name="publicPageStyle"
        value={value}
        defaultChecked={style === value}
        className="mt-1 h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <span className="block">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      {!hideStyleChoice && (
        <div className="grid gap-3 sm:grid-cols-2">
          {styleOption('BOOKING', s.bookingLabel, s.bookingHint)}
          {styleOption('LANDING', s.landingLabel, s.landingHint)}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        {!hideSections && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{s.landingSectionTitle}</h3>
              <p className={hintClass}>{s.landingSectionHint}</p>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>{s.sectionsTitle}</label>
              <p className={hintClass}>{s.sectionsHint}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TOGGLEABLE_LANDING_SECTIONS.map((key) => (
                  <label key={key} className={checkRowClass}>
                    <input
                      type="checkbox"
                      name={`landingSection_${key}`}
                      defaultChecked={
                        lc.sections?.[key] ?? landingSectionEnabledByDefault(key, b.type)
                      }
                      className={checkboxClass}
                    />
                    <span>{s.sectionNames[key]}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {!hideHero && (
          <>
            <div>
              <label className={labelClass}>{s.heroEyebrowLabel}</label>
              <input
                name="landingHeroEyebrow"
                defaultValue={lc.heroEyebrow ?? ''}
                placeholder={s.heroEyebrowPlaceholder}
                maxLength={60}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>{s.heroHeadlineLabel}</label>
              <input
                name="landingHeroHeadline"
                defaultValue={lc.heroHeadline ?? ''}
                placeholder={defaults.heroHeadline}
                maxLength={140}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>{s.heroSubtextLabel}</label>
              <textarea
                name="landingHeroSubtext"
                defaultValue={lc.heroSubtext ?? ''}
                placeholder={defaults.heroSubtext}
                rows={2}
                maxLength={400}
                className={inputClass}
              />
            </div>
          </>
        )}

        <div className="space-y-3">
          <label className={labelClass}>{s.benefitsLabel}</label>
          {Array.from({ length: MAX_BENEFITS }).map((_, i) => {
            const cur = lc.benefits?.[i];
            const def = defaults.benefits[i];
            return (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <input
                  name={`landingBenefit${i}Title`}
                  defaultValue={cur?.title ?? ''}
                  placeholder={def?.title ?? s.benefitTitlePlaceholder}
                  maxLength={60}
                  className={inputClass}
                />
                <input
                  name={`landingBenefit${i}Text`}
                  defaultValue={cur?.text ?? ''}
                  placeholder={def?.text ?? s.benefitTextPlaceholder}
                  maxLength={140}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <label className={labelClass}>{s.galleryLabel}</label>
          <p className={hintClass}>{s.galleryHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: MAX_GALLERY_IMAGES }).map((_, i) => (
              <ImageUploadField
                key={i}
                name={`landingGallery${i}`}
                defaultValue={lc.galleryImageUrls?.[i] ?? ''}
                targetAspect={4 / 3}
                rounded={false}
                maxWidth={1024}
                maxHeight={768}
                mime="image/jpeg"
                labels={galleryLabels}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass}>{s.announcementLabel}</label>
          <p className={hintClass}>{s.announcementHint}</p>
          <textarea
            name="landingAnnouncement"
            defaultValue={lc.announcement ?? ''}
            placeholder={s.announcementPlaceholder}
            rows={2}
            maxLength={200}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label className={labelClass}>{s.googleReviewsLabel}</label>
          <p className={hintClass}>{s.googleReviewsHint}</p>
          <input
            name="landingGoogleReviewsUrl"
            type="url"
            dir="ltr"
            defaultValue={lc.googleReviewsUrl ?? ''}
            placeholder={s.googleReviewsPlaceholder}
            maxLength={2048}
            className={inputClass}
          />
        </div>

        <div className="space-y-3">
          <label className={labelClass}>{s.beforeAfterLabel}</label>
          <p className={hintClass}>{s.beforeAfterHint}</p>
          {Array.from({ length: MAX_BEFORE_AFTER }).map((_, i) => {
            const cur = lc.beforeAfter?.[i];
            return (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className={hintClass}>{s.beforeAfterBeforeLabel}</span>
                    <ImageUploadField
                      name={`landingBefore${i}Url`}
                      defaultValue={cur?.beforeUrl ?? ''}
                      targetAspect={1}
                      rounded={false}
                      maxWidth={800}
                      maxHeight={800}
                      mime="image/jpeg"
                      labels={galleryLabels}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={hintClass}>{s.beforeAfterAfterLabel}</span>
                    <ImageUploadField
                      name={`landingAfter${i}Url`}
                      defaultValue={cur?.afterUrl ?? ''}
                      targetAspect={1}
                      rounded={false}
                      maxWidth={800}
                      maxHeight={800}
                      mime="image/jpeg"
                      labels={galleryLabels}
                    />
                  </div>
                </div>
                <input
                  name={`landingBeforeAfter${i}Label`}
                  defaultValue={cur?.label ?? ''}
                  placeholder={s.beforeAfterCaptionPlaceholder}
                  maxLength={80}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <label className={labelClass}>{s.testimonialsLabel}</label>
          {Array.from({ length: MAX_TESTIMONIALS }).map((_, i) => {
            const cur = lc.testimonials?.[i];
            return (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
              >
                <input
                  name={`landingTestimonial${i}Name`}
                  defaultValue={cur?.name ?? ''}
                  placeholder={s.testimonialNamePlaceholder}
                  maxLength={60}
                  className={inputClass}
                />
                <textarea
                  name={`landingTestimonial${i}Quote`}
                  defaultValue={cur?.quote ?? ''}
                  placeholder={s.testimonialQuotePlaceholder}
                  rows={2}
                  maxLength={280}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <label className={labelClass}>{s.faqLabel}</label>
          <p className={hintClass}>{s.faqHint}</p>
          {Array.from({ length: MAX_FAQ }).map((_, i) => {
            const cur = lc.faq?.[i];
            return (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
              >
                <input
                  name={`landingFaq${i}Question`}
                  defaultValue={cur?.question ?? ''}
                  placeholder={s.faqQuestionPlaceholder}
                  maxLength={160}
                  className={inputClass}
                />
                <textarea
                  name={`landingFaq${i}Answer`}
                  defaultValue={cur?.answer ?? ''}
                  placeholder={s.faqAnswerPlaceholder}
                  rows={2}
                  maxLength={500}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>

        <div>
          <label className={labelClass}>{s.aboutLabel}</label>
          <textarea
            name="landingAbout"
            defaultValue={lc.about ?? ''}
            placeholder={s.aboutPlaceholder}
            rows={4}
            maxLength={900}
            className={inputClass}
          />
        </div>

        <div className="space-y-3">
          <label className={labelClass}>{s.socialTitle}</label>
          <p className={hintClass}>{s.socialHint}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              name="landingSocialWhatsapp"
              defaultValue={lc.socialLinks?.whatsapp ?? ''}
              placeholder={s.socialWhatsappPlaceholder}
              maxLength={2048}
              className={inputClass}
            />
            <input
              name="landingSocialInstagram"
              defaultValue={lc.socialLinks?.instagram ?? ''}
              placeholder={s.socialInstagramPlaceholder}
              maxLength={2048}
              className={inputClass}
            />
            <input
              name="landingSocialFacebook"
              defaultValue={lc.socialLinks?.facebook ?? ''}
              placeholder={s.socialFacebookPlaceholder}
              maxLength={2048}
              className={inputClass}
            />
            <input
              name="landingSocialTiktok"
              defaultValue={lc.socialLinks?.tiktok ?? ''}
              placeholder={s.socialTiktokPlaceholder}
              maxLength={2048}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{s.ctaLabelLabel}</label>
          <input
            name="landingCtaLabel"
            defaultValue={lc.ctaLabel ?? ''}
            placeholder={s.ctaLabelPlaceholder}
            maxLength={40}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}

export type PolicyValues = Pick<
  BusinessSettings,
  | 'minLeadTimeMinutes'
  | 'cancellationWindowHours'
  | 'slotGranularityMinutes'
  | 'maxAdvanceBookingDays'
  | 'bookingRequiresApproval'
  | 'requirePhoneVerification'
  | 'allowBookingWithoutPhone'
>;

export function PolicyFields({ s }: { s: PolicyValues }) {
  const c = t.admin.settings.policy;
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label className={labelClass}>{c.minLeadLabel}</label>
          <input
            name="minLeadTimeMinutes"
            type="number"
            min={0}
            step={1}
            dir="ltr"
            defaultValue={s.minLeadTimeMinutes}
            className={inputClass}
          />
          <p className={hintClass}>{c.minLeadHint}</p>
        </div>
        <div className="flex-1">
          <label className={labelClass}>{c.cancellationLabel}</label>
          <input
            name="cancellationWindowHours"
            type="number"
            min={0}
            step={1}
            dir="ltr"
            defaultValue={s.cancellationWindowHours}
            className={inputClass}
          />
          <p className={hintClass}>{c.cancellationHint}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label className={labelClass}>{c.slotLabel}</label>
          <input
            name="slotGranularityMinutes"
            type="number"
            min={1}
            step={1}
            dir="ltr"
            defaultValue={s.slotGranularityMinutes}
            className={inputClass}
          />
          <p className={hintClass}>{c.slotHint}</p>
        </div>
        <div className="flex-1">
          <label className={labelClass}>{c.maxAdvanceLabel}</label>
          <input
            name="maxAdvanceBookingDays"
            type="number"
            min={1}
            step={1}
            dir="ltr"
            defaultValue={s.maxAdvanceBookingDays}
            className={inputClass}
          />
        </div>
      </div>

      <label className={checkRowClass}>
        <input
          type="checkbox"
          name="bookingRequiresApproval"
          defaultChecked={s.bookingRequiresApproval}
          className={checkboxClass}
        />
        <span>
          {c.requiresApprovalLabel}
          <span className={hintClass + ' block'}>{c.requiresApprovalHint}</span>
        </span>
      </label>

      <label className={checkRowClass}>
        <input
          type="checkbox"
          name="requirePhoneVerification"
          defaultChecked={s.requirePhoneVerification}
          className={checkboxClass}
        />
        <span>
          {c.requireVerificationLabel}
          <span className={hintClass + ' block'}>{c.requireVerificationHint}</span>
        </span>
      </label>

      <label className={checkRowClass}>
        <input
          type="checkbox"
          name="allowBookingWithoutPhone"
          defaultChecked={s.allowBookingWithoutPhone}
          className={checkboxClass}
        />
        <span>
          {c.allowNoPhoneLabel}
          <span className={hintClass + ' block'}>{c.allowNoPhoneHint}</span>
        </span>
      </label>
    </>
  );
}

export type TransparencyValues = Pick<
  BusinessSettings,
  'showPricesPublic' | 'showDurationPublic' | 'showStaffPublic'
>;

export function TransparencyFields({ s }: { s: TransparencyValues }) {
  const c = t.admin.settings.transparency;
  return (
    <>
      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <label className={checkRowClass}>
          <input
            type="checkbox"
            name="showPricesPublic"
            defaultChecked={s.showPricesPublic}
            className={checkboxClass}
          />
          {c.showPricesLabel}
        </label>
        <label className={checkRowClass}>
          <input
            type="checkbox"
            name="showDurationPublic"
            defaultChecked={s.showDurationPublic}
            className={checkboxClass}
          />
          {c.showDurationLabel}
        </label>
        <label className={checkRowClass}>
          <input
            type="checkbox"
            name="showStaffPublic"
            defaultChecked={s.showStaffPublic}
            className={checkboxClass}
          />
          {c.showStaffLabel}
        </label>
      </div>
      <p className={hintClass}>{c.hint}</p>
    </>
  );
}

export type TextsValues = Pick<
  BusinessSettings,
  'welcomeMessage' | 'confirmationMessage' | 'policyText'
>;

export function TextsFields({ s }: { s: TextsValues }) {
  const c = t.admin.settings.texts;
  return (
    <>
      <div>
        <label className={labelClass}>{c.welcomeLabel}</label>
        <textarea
          name="welcomeMessage"
          rows={2}
          defaultValue={s.welcomeMessage ?? ''}
          placeholder={c.welcomePlaceholder}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>{c.confirmationLabel}</label>
        <textarea
          name="confirmationMessage"
          rows={2}
          defaultValue={s.confirmationMessage ?? ''}
          placeholder={c.confirmationPlaceholder}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>{c.policyLabel}</label>
        <textarea
          name="policyText"
          rows={3}
          defaultValue={s.policyText ?? ''}
          placeholder={c.policyPlaceholder}
          className={inputClass}
        />
      </div>
    </>
  );
}

export type RemindersValues = Pick<
  BusinessSettings,
  'remindersEnabled' | 'reminderChannel' | 'reminderLeadHours' | 'confirmationRequired'
>;

export function RemindersFields({ s }: { s: RemindersValues }) {
  const c = t.admin.settings.reminders;
  return (
    <>
      <label className={checkRowClass}>
        <input
          type="checkbox"
          name="remindersEnabled"
          defaultChecked={s.remindersEnabled}
          className={checkboxClass}
        />
        {c.enabledLabel}
      </label>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label className={labelClass}>{c.channelLabel}</label>
          <select
            name="reminderChannel"
            defaultValue={s.reminderChannel}
            className={inputClass}
          >
            {/* אוטומטי כברירת מחדל; מייל ומסרון נשארים כעקיפה ידנית מתחת. */}
            <option value={ReminderChannel.AUTO}>
              {t.admin.settings.channels.AUTO}
            </option>
            <option value={ReminderChannel.EMAIL}>
              {t.admin.settings.channels.EMAIL}
            </option>
            <option value={ReminderChannel.SMS}>
              {t.admin.settings.channels.SMS}
            </option>
          </select>
          <p className={hintClass}>{c.channelAutoHint}</p>
        </div>
        <div className="flex-1">
          <label className={labelClass}>{c.leadHoursLabel}</label>
          <input
            name="reminderLeadHours"
            type="number"
            min={0}
            step={1}
            dir="ltr"
            defaultValue={s.reminderLeadHours}
            className={inputClass}
          />
        </div>
      </div>

      <label className={checkRowClass}>
        <input
          type="checkbox"
          name="confirmationRequired"
          defaultChecked={s.confirmationRequired}
          className={checkboxClass}
        />
        <span>
          {c.confirmationRequiredLabel}
          <span className={hintClass + ' block'}>{c.confirmationRequiredHint}</span>
        </span>
      </label>
    </>
  );
}
