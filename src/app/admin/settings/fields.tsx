import type { Business, BusinessSettings } from '@prisma/client';
import { BusinessType, ReminderChannel } from '@prisma/client';
import Link from 'next/link';
import { t } from '@/i18n';
import { BRAND } from '@/config/brand';
import { inputClass } from './fieldStyles';
import { BrandColorField } from './BrandColorField';
import { TimezoneField } from './TimezoneField';
import { ImageUploadField } from './ImageUploadField';

/**
 * קבוצות שדות משותפות למודול ההגדרות וההקמה.
 * רכיבים פרזנטטיביים בלבד (ללא hooks) — נטענים גם מעמוד השרת וגם מאשף הלקוח.
 */

export { inputClass };
const labelClass = 'mb-1 block text-sm font-medium text-[#4a4038]';
const hintClass = 'mt-1 text-xs text-[#8f8478]';
const checkRowClass = 'flex items-start gap-2 text-sm text-[#4a4038]';
const checkboxClass =
  'mt-0.5 h-4 w-4 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500';

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

export type PolicyValues = Pick<
  BusinessSettings,
  | 'minLeadTimeMinutes'
  | 'cancellationWindowHours'
  | 'slotGranularityMinutes'
  | 'maxAdvanceBookingDays'
  | 'bookingRequiresApproval'
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
    </>
  );
}

export type RemindersValues = Pick<
  BusinessSettings,
  'remindersEnabled' | 'reminderChannel' | 'reminderLeadHours' | 'confirmationRequired'
>;

export function RemindersFields({
  s,
  isExclusive,
}: {
  s: RemindersValues;
  isExclusive: boolean;
}) {
  const c = t.admin.settings.reminders;
  // מודל הבעל-עסק: אקסקלוסיב בוחר דוא"ל / מסרון / יחד (ברירת מחדל מסרון); שאר
  // החבילות — דוא"ל בלבד, ומסרון/יחד מוצגים מושבתים עם הפניה לשדרוג. הערך AUTO
  // הישן אינו מוצג יותר: אקסקלוסיב נבחר מראש למסרון, שאר החבילות לדוא"ל.
  const isManagedChannel =
    s.reminderChannel === ReminderChannel.EMAIL ||
    s.reminderChannel === ReminderChannel.SMS ||
    s.reminderChannel === ReminderChannel.BOTH;
  const selectedChannel = isExclusive
    ? isManagedChannel
      ? s.reminderChannel
      : ReminderChannel.SMS
    : ReminderChannel.EMAIL;
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
            defaultValue={selectedChannel}
            className={inputClass}
          >
            <option value={ReminderChannel.EMAIL}>
              {t.admin.settings.channels.EMAIL}
            </option>
            {/* מסרון ושליחה משולבת פעילים בחבילת אקסקלוסיב בלבד. */}
            <option value={ReminderChannel.SMS} disabled={!isExclusive}>
              {t.admin.settings.channels.SMS}
            </option>
            <option value={ReminderChannel.BOTH} disabled={!isExclusive}>
              {t.admin.settings.channels.BOTH}
            </option>
          </select>
          {!isExclusive && (
            <p className={hintClass}>
              {c.channelLockedHint}{' '}
              <Link
                href="/admin/upgrade"
                className="font-medium text-[#82643C] underline-offset-2 hover:text-[#C59D5F] hover:underline"
              >
                {c.channelLockedUpgradeLink}
              </Link>
            </p>
          )}
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
