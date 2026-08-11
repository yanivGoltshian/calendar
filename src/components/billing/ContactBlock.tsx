import { getContactInfo } from '@/config/contact';
import { t } from '@/i18n';

type Tone = 'light' | 'dark';

/**
 * בלוק "שדרוג ופנייה עסקית" — מקור תצוגה יחיד לפרטי הקשר.
 * בשימוש חוזר בעמוד הנחיתה (מקטע התמחור) ובמסך ה-paywall של הבעלים.
 * רכיב שרת בלבד (ללא hooks), עם קישורי tel: ו-mailto: נגישים.
 */
export function ContactBlock({
  tone = 'light',
  showHeading = true,
  className = '',
}: {
  tone?: Tone;
  showHeading?: boolean;
  className?: string;
}) {
  const { phoneDisplay, phoneE164, email } = getContactInfo();
  const c = t.billing.contact;

  const dark = tone === 'dark';
  const headingColor = dark ? 'text-[#F2D695]' : 'text-slate-900';
  const subtitleColor = dark ? 'text-[#9AA7BD]' : 'text-slate-600';
  const labelColor = dark ? 'text-[#9AA7BD]' : 'text-slate-500';
  const linkColor = dark
    ? 'text-[#F2D695] hover:text-[#F7E4B8]'
    : 'text-[#82643C] hover:text-[#C59D5F]';
  const ctaClasses = dark
    ? 'bg-[#C59D5F] text-[#0B1526] hover:bg-[#F2D695]'
    : 'bg-[#0B1526] text-[#F2D695] hover:bg-[#16233A]';

  return (
    <div dir="rtl" className={className}>
      {showHeading && (
        <div className="mb-4">
          <h3 className={`text-lg font-bold ${headingColor}`}>{c.heading}</h3>
          <p className={`mt-1 text-sm ${subtitleColor}`}>{c.subtitle}</p>
        </div>
      )}

      <dl className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className={labelColor}>{c.phoneLabel}:</dt>
          <dd>
            <a
              href={`tel:${phoneE164}`}
              dir="ltr"
              className={`font-semibold underline-offset-2 hover:underline ${linkColor}`}
            >
              {phoneDisplay}
            </a>
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className={labelColor}>{c.emailLabel}:</dt>
          <dd>
            <a
              href={`mailto:${email}`}
              dir="ltr"
              className={`font-semibold underline-offset-2 hover:underline ${linkColor}`}
            >
              {email}
            </a>
          </dd>
        </div>
      </dl>

      <a
        href={`tel:${phoneE164}`}
        className={`mt-4 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition ${ctaClasses}`}
      >
        {c.callCta}
      </a>
    </div>
  );
}

export default ContactBlock;
