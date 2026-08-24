import { BRAND } from '@/config/brand';

/**
 * עזרי "הוספה ליומן" — בונים קישור ל-Google Calendar וקובץ ICS תקני (RFC 5545).
 *
 * זמני התור נשמרים כרגעים מוחלטים ב-UTC (startAt/endAt). לכן די לפלוט אותם
 * בפורמט UTC ‎YYYYMMDDTHHMMSSZ‎ — כל יומן ממיר אוטומטית לאזור הזמן של המשתמש.
 */

export type CalendarEvent = {
  /** מזהה יציב לאירוע (משמש כ-UID ב-ICS). */
  id: string;
  title: string;
  start: Date;
  end: Date;
  details?: string;
  location?: string | null;
};

/** רגע UTC בפורמט הבסיסי של iCalendar: ‎YYYYMMDDTHHMMSSZ‎. */
function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** בריחת תווים מיוחדים בשדות טקסט של ICS (RFC 5545 §3.3.11). */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** קישור לתבנית אירוע ב-Google Calendar (נפתח בלשונית חדשה). */
export function buildGoogleCalendarUrl(evt: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: evt.title,
    dates: `${toIcsUtc(evt.start)}/${toIcsUtc(evt.end)}`,
  });
  if (evt.details) params.set('details', evt.details);
  if (evt.location) params.set('location', evt.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** תוכן קובץ ICS יחיד (Apple Calendar / Outlook / כל יומן תקני). */
export function buildIcs(evt: CalendarEvent): string {
  const stamp = toIcsUtc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${BRAND.name}//Appointments//HE`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${evt.id}@torchick`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(evt.start)}`,
    `DTEND:${toIcsUtc(evt.end)}`,
    `SUMMARY:${escapeIcsText(evt.title)}`,
  ];
  if (evt.details) lines.push(`DESCRIPTION:${escapeIcsText(evt.details)}`);
  if (evt.location) lines.push(`LOCATION:${escapeIcsText(evt.location)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
