import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getActiveBusiness } from '@/server/repos/business';
import { readBusinessImportReview } from '@/server/businessImport/provision';
import type { BusinessImportWarning } from '@/server/businessImport';

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
    'missing-media': 'לא נמצאו תמונות עסק מתאימות.',
    'unsupported-currency': 'מחיר במטבע שאינו נתמך הוסתר עד לבדיקה ידנית.',
    'default-duration': 'לשירות ללא משך הוגדר משך טכני מוסתר עד לבדיקה ידנית.',
    'media-storage-unavailable':
      'נמצאו תמונות, אך אחסון המדיה לא היה זמין. קישורים חיצוניים לא נשמרו.',
    'media-fetch-failed':
      'תמונה ציבורית לא נקלטה למדיה שבבעלות העסק. קישור חיצוני לא נשמר.',
  };
  return messages[code];
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

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="שירותים שיובאו" value={review.applied.serviceCount} />
        <SummaryCard label="ימי פעילות שיובאו" value={review.applied.hoursCount} />
        <SummaryCard label="קובצי מדיה שנשמרו" value={review.applied.ownedMediaCount} />
      </section>

      {review.warnings.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-lg font-bold text-amber-950">נושאים שדורשים בדיקה</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-950">
            {review.warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`} className="rounded-lg bg-white/70 p-3">
                {warningText(warning.code)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-[#D6C9B1] bg-white p-5">
        <h2 className="text-lg font-bold text-[#172033]">מידע ציבורי שנשמר לבדיקה</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
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
