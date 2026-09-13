import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getActiveBusiness } from '@/server/repos/business';
import { readBusinessImportReview } from '@/server/businessImport/provision';
import type {
  BusinessImportEvidence,
  BusinessImportWarning,
} from '@/server/businessImport';

export const metadata = { title: 'בדיקת ייבוא העסק' };

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#D6C9B1] bg-white p-4">
      <div className="text-sm text-[#6A6258]">{label}</div>
      <div className="mt-1 text-xl font-bold text-[#172033]">{value}</div>
    </div>
  );
}

function warningText(code: BusinessImportWarning['code']): string {
  const messages: Record<BusinessImportWarning['code'], string> = {
    'platform-metadata-only':
      'המקור מאפשר גישה למידע ציבורי חלקי בלבד. יש לבדוק ידנית פרטים שלא נטענו.',
    'platform-blocked': 'הפלטפורמה חסמה חלק מהמידע הציבורי.',
    'page-fetch-failed': 'עמוד פנימי רלוונטי לא נטען.',
    'invalid-json-ld': 'נמצא מידע מובנה לא תקין שלא ניתן היה להשתמש בו.',
    'missing-name': 'לא נמצא שם עסק במקור.',
    'missing-contact': 'לא נמצאו פרטי קשר ציבוריים.',
    'missing-address': 'לא נמצאה כתובת מלאה.',
    'missing-hours': 'לא נמצאו שעות פעילות.',
    'missing-services': 'לא נמצאו שירותים.',
    'missing-staff': 'לא נמצאו פרופילים ציבוריים של אנשי צוות.',
    'missing-policy': 'לא נמצאה מדיניות הזמנות ציבורית.',
    'missing-media': 'לא נמצאו תמונות עסק מתאימות.',
    'social-profile-fetch-failed':
      'פרופיל חברתי ציבורי מקושר לא נטען. שאר המקורות נשמרו כרגיל.',
    'staff-service-links-assumed':
      'לא נמצאו שיוכים מפורשים בין צוות לשירותים. השירותים שויכו לאיש הצוות הראשי לבדיקה.',
    'unsupported-currency': 'מחיר במטבע שאינו נתמך הוסתר עד לבדיקה ידנית.',
    'default-duration': 'לשירות ללא משך הוגדר משך טכני מוסתר עד לבדיקה ידנית.',
    'media-storage-unavailable':
      'נמצאו תמונות, אך אחסון המדיה לא היה זמין. קישורים חיצוניים לא נשמרו.',
    'media-fetch-failed':
      'תמונה ציבורית לא נקלטה למדיה שבבעלות העסק. קישור חיצוני לא נשמר.',
    'media-rejected': 'פריט מדיה נדחה מפני שהיה קטן מדי או שתוכנו לא תאם לפורמט המוצהר.',
    'result-truncated':
      'חלק מהתוצאות הוגבלו לצורך עיבוד בטוח. ייתכן שיש פריטים נוספים במקור שלא נשמרו בטיוטה.',
  };
  return messages[code];
}

const missingFieldLabels: Record<string, string> = {
  'business.name': 'שם העסק',
  'business.category': 'קטגוריה או סוג עסק',
  'contacts.phone': 'טלפון',
  'contacts.email': 'אימייל',
  'location.address': 'כתובת',
  hours: 'שעות פעילות',
  services: 'שירותים',
  staff: 'צוות',
  'media.logo': 'לוגו',
  'media.hero': 'תמונת נושא',
  'media.gallery': 'גלריה',
  bookingPolicy: 'מדיניות הזמנות',
};

function confidenceText(confidence: BusinessImportEvidence['confidence']): string {
  if (confidence === 'high') return 'גבוה';
  if (confidence === 'medium') return 'בינוני';
  if (confidence === 'low') return 'נמוך';
  return 'לא ידוע';
}

export default async function BusinessImportReviewPage() {
  const business = await getActiveBusiness();
  if (!business?.businessImportedAt || !business.businessImportSourceUrl) notFound();
  const review = readBusinessImportReview(business.businessImportDraft);
  if (!review) notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8" dir="rtl">
      <section className="rounded-2xl border border-[#D6C9B1] bg-[#FFFDF8] p-5 sm:p-7">
        <p className="text-sm font-semibold text-[#8B6A2F]">טיוטה לבדיקה</p>
        <h1 className="mt-1 text-3xl font-bold text-[#172033]">{business.name}</h1>
        <p className="mt-3 max-w-3xl text-[#575F6E]">
          הנתונים נשאבו ונשמרו בעסק, אך העסק לא פורסם אוטומטית. עברו על הפרטים, השירותים
          ושעות הפעילות לפני השלמת ההקמה.
        </p>
        <a
          href={business.businessImportSourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block break-all text-sm text-[#7C5B1F] underline"
        >
          {business.businessImportSourceUrl}
        </a>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="שירותים שיובאו" value={review.applied.serviceCount} />
        <SummaryCard label="אנשי צוות שנמצאו" value={review.applied.staffCount ?? 0} />
        <SummaryCard label="ימי פעילות שיובאו" value={review.applied.hoursCount} />
        <SummaryCard label="קובצי מדיה שנשמרו" value={review.applied.ownedMediaCount} />
        <SummaryCard
          label="שדות מדיניות שיובאו"
          value={review.applied.bookingPolicyFieldCount ?? 0}
        />
      </section>

      {(review.missingFields?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-rose-300 bg-rose-50 p-5">
          <h2 className="text-lg font-bold text-rose-950">מידע שחסר להשלמת ההקמה</h2>
          <p className="mt-1 text-sm text-rose-900">
            השדות האלה נשארו ריקים בכוונה, משום שלא נמצא להם מקור ציבורי אמין.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {review.missingFields?.map((field) => (
              <li
                key={field}
                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-sm text-rose-950"
              >
                {missingFieldLabels[field] ?? field}
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.warnings.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-bold text-amber-950">נושאים שדורשים בדיקה</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-950">
            {review.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`} className="rounded-lg bg-white/70 p-3">
                <p className="font-medium">{warningText(warning.code)}</p>
                <p className="mt-1 break-words text-xs text-amber-900" dir="auto">
                  {warning.message}
                </p>
                {warning.sourceUrl ? (
                  <a
                    href={warning.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all text-xs text-[#7C5B1F] underline"
                  >
                    {warning.sourceUrl}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-[#D6C9B1] bg-white p-5">
        <h2 className="text-lg font-bold text-[#172033]">פרופיל ופרטי קשר</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[#6A6258]">תיאור</dt>
            <dd className="mt-1 whitespace-pre-line text-[#172033]">
              {review.draft.business.description ?? 'לא נמצא'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">קטגוריה</dt>
            <dd className="mt-1 text-[#172033]">
              {review.draft.business.category ??
                review.draft.business.industry ??
                review.draft.business.typeSuggestion ??
                'לא נמצאה'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">כתובת</dt>
            <dd className="mt-1 text-[#172033]">
              {review.draft.location.formattedAddress ?? 'לא נמצאה'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">אתר</dt>
            <dd className="mt-1 break-all text-[#172033]">
              {review.draft.business.websiteUrl ?? 'לא נמצא'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">טלפונים</dt>
            <dd className="mt-1 text-[#172033]">
              {review.draft.contacts.phones.join(', ') || 'לא נמצאו'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">כתובות אימייל</dt>
            <dd className="mt-1 break-all text-[#172033]">
              {review.draft.contacts.emails.join(', ') || 'לא נמצאו'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">קישורים חברתיים</dt>
            <dd className="mt-1 break-all text-[#172033]">
              {review.draft.socialLinks.map(({ url }) => url).join(', ') || 'לא נמצאו'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">קישורי וידאו</dt>
            <dd className="mt-1 break-all text-[#172033]">
              {review.draft.media.videoUrls.join(', ') || 'לא נמצאו'}
            </dd>
          </div>
        </dl>
      </section>

      {review.applied.mediaAssets?.length ? (
        <section className="rounded-2xl border border-[#D6C9B1] bg-white p-5">
          <h2 className="text-lg font-bold text-[#172033]">מדיה שנקלטה בבעלות העסק</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {review.applied.mediaAssets.map((asset, index) => (
              <article
                key={`${asset.role}-${asset.sourceUrl}-${index}`}
                className="overflow-hidden rounded-xl border border-[#E7DDCA]"
              >
                {asset.contentType.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.storedUrl}
                    alt=""
                    className="aspect-video w-full bg-slate-100 object-cover"
                  />
                ) : (
                  <video
                    src={asset.storedUrl}
                    controls
                    preload="metadata"
                    className="aspect-video w-full bg-black object-contain"
                  />
                )}
                <div className="space-y-1 p-3 text-xs text-[#575F6E]">
                  <p className="font-semibold text-[#172033]">{asset.role}</p>
                  {asset.width && asset.height ? (
                    <p dir="ltr">
                      {asset.width} × {asset.height}
                    </p>
                  ) : null}
                  <a
                    href={asset.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all underline"
                  >
                    מקור
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {review.draft.services.length > 0 ? (
        <section className="rounded-2xl border border-[#D6C9B1] bg-white p-5">
          <h2 className="text-lg font-bold text-[#172033]">שירותים</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-[#6A6258]">
                <tr>
                  <th className="p-2">שירות</th>
                  <th className="p-2">משך</th>
                  <th className="p-2">מחיר</th>
                  <th className="p-2">מקור</th>
                </tr>
              </thead>
              <tbody>
                {review.draft.services.map((service) => (
                  <tr key={`${service.name}-${service.sourceUrl}`} className="border-t">
                    <td className="p-2">
                      <p className="font-semibold">{service.name}</p>
                      {service.description ? (
                        <p className="mt-1 max-w-xl text-[#575F6E]">
                          {service.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-2">
                      {service.durationMinutes
                        ? `${service.durationMinutes} דקות`
                        : 'חסר'}
                    </td>
                    <td className="p-2">
                      {service.price !== null
                        ? `${service.price} ${service.currency ?? ''}`.trim()
                        : 'חסר'}
                    </td>
                    <td className="p-2">
                      <a
                        href={service.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        קישור
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {review.draft.staff.length > 0 || review.draft.hours.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#D6C9B1] bg-white p-5">
            <h2 className="text-lg font-bold text-[#172033]">צוות</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {review.draft.staff.map((member) => (
                <li key={member.name} className="rounded-xl bg-[#FFFDF8] p-3">
                  <p className="font-semibold">{member.name}</p>
                  {member.title ? <p>{member.title}</p> : null}
                  {member.bio ? (
                    <p className="mt-1 text-[#575F6E]">{member.bio}</p>
                  ) : null}
                </li>
              ))}
              {review.draft.staff.length === 0 ? <li>לא נמצא צוות ציבורי.</li> : null}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#D6C9B1] bg-white p-5">
            <h2 className="text-lg font-bold text-[#172033]">שעות פעילות</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {review.draft.hours.map((hours, index) => (
                <li key={`${hours.raw}-${index}`} className="rounded-xl bg-[#FFFDF8] p-3">
                  {hours.raw}
                </li>
              ))}
              {review.draft.hours.length === 0 ? <li>לא נמצאו שעות פעילות.</li> : null}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#D6C9B1] bg-white p-5">
        <h2 className="text-lg font-bold text-[#172033]">מדיניות הזמנות</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[#6A6258]">זמן מינימלי מראש</dt>
            <dd className="mt-1">
              {review.draft.bookingPolicy.minLeadTimeMinutes !== null
                ? `${review.draft.bookingPolicy.minLeadTimeMinutes} דקות`
                : 'לא נמצא'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">חלון ביטול</dt>
            <dd className="mt-1">
              {review.draft.bookingPolicy.cancellationWindowHours !== null
                ? `${review.draft.bookingPolicy.cancellationWindowHours} שעות`
                : 'לא נמצא'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">טווח הזמנה עתידי</dt>
            <dd className="mt-1">
              {review.draft.bookingPolicy.maxAdvanceBookingDays !== null
                ? `${review.draft.bookingPolicy.maxAdvanceBookingDays} ימים`
                : 'לא נמצא'}
            </dd>
          </div>
          <div>
            <dt className="text-[#6A6258]">אישור ידני לתור</dt>
            <dd className="mt-1">
              {review.draft.bookingPolicy.bookingRequiresApproval === null
                ? 'לא נמצא'
                : review.draft.bookingPolicy.bookingRequiresApproval
                  ? 'נדרש'
                  : 'לא נדרש'}
            </dd>
          </div>
        </dl>
        {review.draft.bookingPolicy.notes.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-[#575F6E]">
            {review.draft.bookingPolicy.notes.map((note) => (
              <li key={note} className="rounded-xl bg-[#FFFDF8] p-3">
                {note}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#D6C9B1] bg-white p-5">
        <h2 className="text-lg font-bold text-[#172033]">מקורות ורמת ביטחון</h2>
        <div className="mt-3 rounded-xl border border-[#E7DDCA] p-3 text-sm">
          <p className="font-semibold text-[#172033]">עמודים ציבוריים שנבדקו</p>
          <ul className="mt-2 space-y-1">
            {review.draft.fetchedUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[#7C5B1F] underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {review.draft.evidence.map((evidence, index) => (
            <li
              key={`${evidence.field}-${evidence.sourceUrl}-${index}`}
              className="rounded-xl bg-[#FFFDF8] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <code dir="ltr" className="rounded bg-slate-100 px-2 py-0.5">
                  {evidence.field}
                </code>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  ביטחון {confidenceText(evidence.confidence)}
                </span>
                <span className="text-[#6A6258]">{evidence.method}</span>
              </div>
              <p className="mt-2 whitespace-pre-line break-words">{evidence.value}</p>
              <a
                href={evidence.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-xs text-[#7C5B1F] underline"
              >
                {evidence.sourceUrl}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {[
          ['/admin/settings', 'בדיקת פרטי העסק והמיתוג'],
          ['/admin/services', 'בדיקת השירותים והמחירים'],
          ['/admin/working-hours', 'בדיקת שעות הפעילות'],
          ['/admin/onboarding', 'המשך הקמה ופרסום'],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="min-h-[56px] rounded-xl border border-[#D6C9B1] bg-white px-4 py-4 font-semibold text-[#172033] hover:bg-[#FFF8E8]"
          >
            {label}
          </Link>
        ))}
      </section>
    </main>
  );
}
