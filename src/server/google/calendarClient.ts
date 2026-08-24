/**
 * לקוח REST רזה ל-Google Calendar / OAuth — fetch ידני, ללא תלות ב-googleapis.
 *
 * המודול טהור מבחינת אחסון: הוא רק מדבר עם Google (החלפת קוד, רענון טוקן, freeBusy,
 * יצירת/מחיקת אירוע, שליפת אימייל). ניהול ההצפנה וההתמדה נעשה בשכבת ה-repo.
 *
 * כל קריאה עטופה ב-AbortController עם timeout, כדי שתקלה/איטיות אצל Google לא
 * תתקע את הבקשה שלנו (בעיקר בנתיב הזמינות החם — שם נכשלים "פתוח").
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const EVENTS_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type BusyInterval = { startAt: Date; endAt: Date };

function clientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error('missing_GOOGLE_CLIENT_ID');
  return v;
}
function clientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error('missing_GOOGLE_CLIENT_SECRET');
  return v;
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await run(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** בונה את כתובת ההסכמה של Google (offline + consent כדי לקבל refresh token). */
export function buildAuthUrl(params: {
  redirectUri: string;
  scope: string;
  state: string;
  loginHint?: string;
}): string {
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: params.scope,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: params.state,
  });
  if (params.loginHint) q.set('login_hint', params.loginHint);
  return `${AUTH_URL}?${q.toString()}`;
}

/** מחליף authorization code בטוקנים. */
export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  return withTimeout(10000, async (signal) => {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal,
    });
    if (!res.ok) throw new Error(`token_exchange_failed_${res.status}:${await safeText(res)}`);
    return (await res.json()) as GoogleTokenResponse;
  });
}

/** מרענן access token באמצעות refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'refresh_token',
  });
  return withTimeout(10000, async (signal) => {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal,
    });
    if (!res.ok) throw new Error(`token_refresh_failed_${res.status}:${await safeText(res)}`);
    return (await res.json()) as GoogleTokenResponse;
  });
}

/** שולף את כתובת האימייל של החשבון המחובר (לתצוגה בלבד). */
export async function getUserEmail(accessToken: string): Promise<string | null> {
  try {
    return await withTimeout(6000, async (signal) => {
      const res = await fetch(USERINFO_URL, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { email?: string };
      return json.email ?? null;
    });
  } catch {
    return null;
  }
}

/**
 * שולף חלונות עמוסים (busy) מהיומן בטווח נתון. timeoutMs קצר בשימוש בנתיב החם.
 * מחזיר מערך אינטרוולים; זורק אם Google מחזיר שגיאה (הקורא אחראי ל-fail-open).
 */
export async function getFreeBusy(params: {
  accessToken: string;
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
  timeoutMs?: number;
}): Promise<BusyInterval[]> {
  const { accessToken, calendarId, timeMin, timeMax, timeoutMs = 4000 } = params;
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetch(FREEBUSY_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      }),
      signal,
    });
    if (!res.ok) throw new Error(`freebusy_failed_${res.status}:${await safeText(res)}`);
    const json = (await res.json()) as {
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
    };
    const cal = json.calendars?.[calendarId];
    const busy = cal?.busy ?? [];
    return busy
      .map((b) => ({ startAt: new Date(b.start), endAt: new Date(b.end) }))
      .filter((b) => !Number.isNaN(b.startAt.getTime()) && !Number.isNaN(b.endAt.getTime()));
  });
}

export type GoogleEventInput = {
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  timeZone?: string;
};

/** יוצר אירוע ביומן. מחזיר את מזהה האירוע שנוצר. */
export async function insertEvent(params: {
  accessToken: string;
  calendarId: string;
  event: GoogleEventInput;
  timeoutMs?: number;
}): Promise<string> {
  const { accessToken, calendarId, event, timeoutMs = 8000 } = params;
  const tz = event.timeZone ?? 'Asia/Jerusalem';
  return withTimeout(timeoutMs, async (signal) => {
    const res = await fetch(`${EVENTS_BASE}/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.start.toISOString(), timeZone: tz },
        end: { dateTime: event.end.toISOString(), timeZone: tz },
      }),
      signal,
    });
    if (!res.ok) throw new Error(`event_insert_failed_${res.status}:${await safeText(res)}`);
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error('event_insert_no_id');
    return json.id;
  });
}

/** מוחק אירוע מהיומן. 404/410 (כבר נמחק) נחשבים הצלחה אידמפוטנטית. */
export async function deleteEvent(params: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  timeoutMs?: number;
}): Promise<void> {
  const { accessToken, calendarId, eventId, timeoutMs = 8000 } = params;
  await withTimeout(timeoutMs, async (signal) => {
    const res = await fetch(
      `${EVENTS_BASE}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${accessToken}` }, signal },
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      throw new Error(`event_delete_failed_${res.status}:${await safeText(res)}`);
    }
  });
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}
