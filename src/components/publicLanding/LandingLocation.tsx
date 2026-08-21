import { formatMinutes } from '@/lib/time';
import { mapEmbedUrl, googleMapsSearchUrl, wazeUrl } from '@/lib/mapLinks';
import { formatIsraeliPhoneDisplay } from '@/lib/phoneDisplay';
import { socialHref } from '@/lib/socialLinks';
import { MapPinIcon, PhoneIcon, NavigationIcon, ClockIcon, WhatsappIcon } from './icons';
import SectionHeading from './SectionHeading';

type WorkingHour = { weekday: number; startMinute: number; endMinute: number };

type Props = {
  title: string;
  workingHours: WorkingHour[];
  weekdays: readonly string[];
  closedLabel: string;
  todayIdx: number;
  address?: string | null;
  phone?: string | null;
  directionsCta: string;
  callCta: string;
  eyebrow?: string;
  // מצב פרימיום (קליניקה): כאשר mapsCta+wazeCta מסופקים, מוצג כרטיס מפה מוטמע צף
  // לצד טור פרטים וכפתורי ניווט Google/Waze. עסקים אחרים לא מספקים אותם ולכן
  // ממשיכים עם הפריסה הקיימת ללא שינוי חזותי.
  mapsCta?: string;
  wazeCta?: string;
  whatsappCta?: string;
  whatsapp?: string | null;
  contactCta?: string;
  navTitle?: string;
  mapTitle?: string;
};

// מקטע מיקום ושעות — טבלת שעות פעילות לצד כתובת, ניווט וטלפון.
// במצב פרימיום מוצג כרטיס מפה מוטמע צף וכפתורי ניווט Google Maps ו-Waze.
export default function LandingLocation({
  title,
  workingHours,
  weekdays,
  closedLabel,
  todayIdx,
  address,
  phone,
  directionsCta,
  callCta,
  eyebrow,
  mapsCta,
  wazeCta,
  whatsappCta,
  whatsapp,
  contactCta,
  navTitle,
  mapTitle,
}: Props) {
  const hasHours = workingHours.length > 0;
  if (!hasHours && !address && !phone) return null;

  const byDay = new Map<number, WorkingHour>();
  for (const wh of workingHours) byDay.set(wh.weekday, wh);

  const premium = Boolean(mapsCta && wazeCta);
  const embedUrl = mapEmbedUrl(address);
  const gmapsUrl = googleMapsSearchUrl(address);
  const wazeHref = wazeUrl(address);
  const phoneDisplay = formatIsraeliPhoneDisplay(phone);
  const whatsappTrimmed = whatsapp?.trim();

  // ── מצב פרימיום (קליניקה): כרטיס מפה מוטמע צף + טור פרטים + כפתורי ניווט ──
  if (premium && embedUrl) {
    return (
      <section id="lp-location" className="mt-16 scroll-mt-24 sm:mt-24">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* כרטיס מפה מוטמע צף */}
          <div className="order-2 min-h-[340px] overflow-hidden rounded-3xl border border-[color:var(--c-gold,#c6a86a)]/30 shadow-elevated lg:order-1">
            <iframe
              src={embedUrl}
              title={mapTitle ?? title}
              className="h-full min-h-[340px] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>

          {/* טור פרטים: עינית זהב, כותרת סריפית, קו זהב, פרטים וכפתורים */}
          <div className="order-1 flex flex-col justify-center rounded-3xl border border-[color:var(--biz-border)] bg-white p-6 shadow-soft sm:p-8 lg:order-2">
            <SectionHeading align="start" eyebrow={eyebrow} title={title} icon={<MapPinIcon className="h-4 w-4" />} />

            <div className="mt-6 space-y-3 text-sm">
              {address ? (
                <p className="flex items-start gap-2 text-slate-700">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--biz-strong)]" />
                  <span>{address}</span>
                </p>
              ) : null}
              {phone ? (
                <a href={`tel:${phone}`} className="flex items-center gap-2 text-slate-700 transition hover:text-[color:var(--biz-strong)]">
                  <PhoneIcon className="h-4 w-4 shrink-0 text-[color:var(--biz-strong)]" />
                  <span dir="ltr" className="tabular-nums">{phoneDisplay}</span>
                </a>
              ) : null}
              {hasHours ? (
                <div className="flex items-start gap-2 text-slate-700">
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--biz-strong)]" />
                  <ul className="space-y-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                      const wh = byDay.get(d);
                      if (!wh) return null;
                      return (
                        <li key={d} className={`flex gap-2 ${d === todayIdx ? 'font-semibold text-[color:var(--biz-strong)]' : ''}`}>
                          <span className="min-w-[3.5rem]">{weekdays[d]}</span>
                          <span dir="ltr" className="tabular-nums">
                            {formatMinutes(wh.startMinute)}–{formatMinutes(wh.endMinute)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {phone ? (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-[color:var(--biz)] to-[color:var(--biz-strong)] px-5 py-2.5 text-sm font-bold text-[color:var(--biz-ink)] shadow-soft transition hover:-translate-y-0.5"
                >
                  <PhoneIcon className="h-4 w-4" />
                  {contactCta ?? callCta}
                </a>
              ) : null}
              {whatsappTrimmed ? (
                <a
                  href={socialHref('whatsapp', whatsappTrimmed)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--biz-border)] px-5 py-2.5 text-sm font-semibold text-[color:var(--biz-strong)] transition hover:border-[color:var(--biz)] hover:bg-[color:var(--biz-soft)]"
                >
                  <WhatsappIcon className="h-4 w-4" />
                  {whatsappCta}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* שני כפתורי ניווט — Google Maps ו-Waze, נבנים מהכתובת המקודדת */}
        {gmapsUrl || wazeHref ? (
          <div className="mt-6">
            {navTitle ? (
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--biz-strong)]">
                {navTitle}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {gmapsUrl ? (
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--biz-border)] bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-soft transition hover:border-[color:var(--biz)] hover:text-[color:var(--biz-strong)]"
                >
                  <NavigationIcon className="h-4 w-4 text-[color:var(--biz-strong)]" />
                  {mapsCta}
                </a>
              ) : null}
              {wazeHref ? (
                <a
                  href={wazeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--biz-border)] bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 shadow-soft transition hover:border-[color:var(--biz)] hover:text-[color:var(--biz-strong)]"
                >
                  <NavigationIcon className="h-4 w-4 text-[color:var(--biz-strong)]" />
                  {wazeCta}
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  // ── מצב רגיל (עסקים אחרים): הפריסה הקיימת, ללא שינוי חזותי ──
  const mapHref = gmapsUrl;
  return (
    <section id="lp-location" className="mt-16 scroll-mt-24 sm:mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} icon={<MapPinIcon className="h-4 w-4" />} />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {hasHours ? (
          <ul className="overflow-hidden rounded-3xl border border-[color:var(--biz-border)] bg-white shadow-soft">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const wh = byDay.get(d);
              const isToday = d === todayIdx;
              return (
                <li
                  key={d}
                  className={`flex items-center justify-between px-5 py-3 text-sm ${d > 0 ? 'border-t border-slate-100' : ''} ${isToday ? 'bg-[var(--biz-soft)] font-semibold' : ''}`}
                >
                  <span className="text-slate-900">{weekdays[d]}</span>
                  {wh ? (
                    <span dir="ltr" className="tabular-nums text-slate-700">
                      {formatMinutes(wh.startMinute)}–{formatMinutes(wh.endMinute)}
                    </span>
                  ) : (
                    <span className="text-slate-400">{closedLabel}</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        {address || phone ? (
          <div className="flex flex-col gap-4">
            {address ? (
              <div className="rounded-3xl border border-[color:var(--biz-border)] bg-white p-5 shadow-soft">
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--biz-strong)]" />
                  {address}
                </p>
                {mapHref ? (
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--biz-soft)] px-4 py-2.5 text-sm font-semibold text-[color:var(--biz-strong)] transition hover:bg-[var(--biz)] hover:text-[color:var(--biz-ink)]"
                  >
                    <NavigationIcon className="h-4 w-4" />
                    {directionsCta}
                  </a>
                ) : null}
              </div>
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="flex items-center gap-2 rounded-3xl border border-[color:var(--biz-border)] bg-white p-5 text-sm font-semibold text-slate-700 shadow-soft transition hover:border-[color:var(--biz)]"
              >
                <PhoneIcon className="h-4 w-4 shrink-0 text-[color:var(--biz-strong)]" />
                <span dir="ltr" className="tabular-nums">{phone}</span>
                <span className="ms-auto text-[color:var(--biz-strong)]">{callCta}</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
