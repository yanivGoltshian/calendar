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
      <section
        id="lp-location"
        dir="rtl"
        className="relative mt-16 scroll-mt-24 sm:mt-24"
        style={{
          width: '100vw',
          marginInline: 'calc(50% - 50vw)',
          overflowX: 'clip',
          background:
            'radial-gradient(1200px 500px at 15% -10%, rgba(198,168,106,0.20), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(176,133,95,0.22), transparent 55%), linear-gradient(160deg, #1b1513, #2c2420)',
          color: '#fff',
        }}
      >
        {/* רצועה כהה אופקית: טור פרטים זהב מימין, מפה מוטמעת משמאל (RTL), קורסת לטור אחד במובייל */}
        <div className="mx-auto grid max-w-[1120px] items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2">
          {/* טור טקסט: עינית זהב, כתובת ככותרת, קו זהב, פרטים וכפתורי ניווט */}
          <div className="order-2 lg:order-1">
            {eyebrow ? (
              <p className="text-sm font-extrabold tracking-wide text-[#c6a86a]">{eyebrow}</p>
            ) : null}
            <h2 className="mt-1 font-display text-3xl font-black leading-tight sm:text-4xl">{title}</h2>
            <span
              aria-hidden
              className="mt-3 block h-[3px] w-20 rounded-full"
              style={{ background: 'linear-gradient(90deg, #c6a86a, transparent)' }}
            />

            <ul className="mt-6 space-y-3 text-sm text-white/90">
              {address ? (
                <li className="flex items-start gap-2">
                  <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#c6a86a]" />
                  <span>{address}</span>
                </li>
              ) : null}
              {phone ? (
                <li>
                  <a
                    href={`tel:${phone}`}
                    aria-label={contactCta ?? callCta}
                    className="flex items-center gap-2 transition hover:text-white"
                  >
                    <PhoneIcon className="h-4 w-4 shrink-0 text-[#c6a86a]" />
                    <span dir="ltr" className="tabular-nums">{phoneDisplay}</span>
                  </a>
                </li>
              ) : null}
              {hasHours ? (
                <li className="flex items-start gap-2">
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#c6a86a]" />
                  <ul className="space-y-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                      const wh = byDay.get(d);
                      if (!wh) return null;
                      return (
                        <li key={d} className={`flex gap-2 ${d === todayIdx ? 'font-semibold text-[#c6a86a]' : ''}`}>
                          <span className="min-w-[3.5rem]">{weekdays[d]}</span>
                          <span dir="ltr" className="tabular-nums">
                            {formatMinutes(wh.startMinute)}–{formatMinutes(wh.endMinute)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ) : null}
            </ul>

            {/* כפתורי ניווט: Google (זהב), Waze (רפאים), וואטסאפ (אקו) */}
            <div className="mt-6">
              {navTitle ? (
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#c6a86a]">{navTitle}</p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {gmapsUrl ? (
                  <a
                    href={gmapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[#241d10] shadow-soft transition hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(90deg, #a6863f, #c6a86a)' }}
                  >
                    <NavigationIcon className="h-4 w-4" />
                    {mapsCta}
                  </a>
                ) : null}
                {wazeHref ? (
                  <a
                    href={wazeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                    style={{ background: 'rgba(255,255,255,0.10)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)' }}
                  >
                    <NavigationIcon className="h-4 w-4" />
                    {wazeCta}
                  </a>
                ) : null}
                {whatsappTrimmed && whatsappCta ? (
                  <a
                    href={socialHref('whatsapp', whatsappTrimmed)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
                    style={{ background: '#c08f86' }}
                  >
                    <WhatsappIcon className="h-4 w-4" />
                    {whatsappCta}
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {/* כרטיס מפה מוטמע — יחס-גובה קבוע מונע קפיצת פריסה */}
          <div className="order-1 lg:order-2">
            <div
              className="relative overflow-hidden rounded-[22px] border border-white/15 shadow-elevated"
              style={{ aspectRatio: '4 / 3' }}
            >
              <iframe
                src={embedUrl}
                title={mapTitle ?? title}
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
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
