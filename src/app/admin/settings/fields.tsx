import type { Business, BusinessSettings } from '@prisma/client';
import { BusinessType, ReminderChannel } from '@prisma/client';
import { t } from '@/i18n';

/**
 * קבוצות שדות משותפות למודול ההגדרות וההקמה.
 * רכיבים פרזנטטיביים בלבד (ללא hooks) — נטענים גם מעמוד השרת וגם מאשף הלקוח.
 */

export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
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
          <input
            name="logoUrl"
            dir="ltr"
            defaultValue={b.logoUrl ?? ''}
            placeholder="https://…"
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>{s.coverUrlLabel}</label>
          <input
            name="coverImageUrl"
            dir="ltr"
            defaultValue={b.coverImageUrl ?? ''}
            placeholder="https://…"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>{s.brandColorLabel}</label>
        <input
          name="brandColor"
          dir="ltr"
          defaultValue={b.brandColor ?? ''}
          placeholder="#0A182D"
          className={inputClass}
        />
        <p className={hintClass}>{s.brandColorHint}</p>
      </div>

      <div>
        <label className={labelClass}>{s.timezoneLabel}</label>
        <input
          name="timezone"
          dir="ltr"
          defaultValue={b.timezone ?? 'Asia/Jerusalem'}
          className={inputClass}
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
            {Object.values(ReminderChannel).map((value) => (
              <option key={value} value={value}>
                {t.admin.settings.channels[value]}
              </option>
            ))}
          </select>
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
