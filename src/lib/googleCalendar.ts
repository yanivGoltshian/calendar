/**
 * בניית קישור "הוספה ליומן Google" (תבנית אירוע) — קישור עמוק בלבד, ללא OAuth.
 * זהה בגישתו לקלמארק: המשתמש מופנה ליומן שלו עם האירוע ממולא מראש.
 */

export type CalendarEventInput = {
  title: string;
  start: Date;
  end: Date;
  details?: string;
  location?: string;
};

/** המרת תאריך לפורמט Google (UTC): YYYYMMDDTHHMMSSZ. */
function toGoogleUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** קישור עמוק ליומן Google עם אירוע ממולא מראש. */
export function buildGoogleCalendarUrl(event: CalendarEventInput): string {
  const dates = `${toGoogleUtc(event.start)}/${toGoogleUtc(event.end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
  });
  if (event.details) params.set('details', event.details);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
