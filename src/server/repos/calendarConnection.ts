import { prisma } from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/tokenCrypto';
import { refreshAccessToken } from '@/server/google/calendarClient';
import { ensureOwnerStaffMember } from '@/server/repos/staff';

/**
 * שכבת גישה לחיבור יומן Google של איש צוות (StaffCalendarConnection).
 *
 * אחריות: הצפנה/פענוח טוקנים, שמירה/שליפה, רענון access token עם התמדה, ומתגי סנכרון.
 * הטוקנים נכתבים תמיד מוצפנים; מוחזרים בטקסט גלוי רק בזמן שימוש בשרת.
 */

// חוצץ בטיחות לפני פקיעת access token — מרעננים 60 שניות לפני הזמן.
const EXPIRY_BUFFER_MS = 60 * 1000;

/** שליפת חיבור לפי מזהה איש צוות. */
export function getConnectionByStaffId(staffId: string) {
  return prisma.staffCalendarConnection.findUnique({ where: { staffId } });
}

/** האם קיים חיבור פעיל לאיש הצוות (לגייטינג מהיר). */
export async function hasConnection(staffId: string): Promise<boolean> {
  const c = await prisma.staffCalendarConnection.findUnique({
    where: { staffId },
    select: { id: true },
  });
  return !!c;
}

export type UpsertConnectionInput = {
  staffId: string;
  businessId: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date | null;
  googleEmail: string | null;
  calendarId?: string;
};

/**
 * יוצר/מעדכן חיבור. הטוקנים מוצפנים לפני כתיבה. אם refreshToken ריק (Google לא
 * החזיר אחד ברענון עתידי) — משמרים את הקיים ולא דורסים.
 */
export async function upsertConnection(input: UpsertConnectionInput) {
  const accessTokenEnc = encryptToken(input.accessToken);
  const refreshTokenEnc = input.refreshToken ? encryptToken(input.refreshToken) : undefined;
  const calendarId = input.calendarId ?? 'primary';

  return prisma.staffCalendarConnection.upsert({
    where: { staffId: input.staffId },
    create: {
      staffId: input.staffId,
      businessId: input.businessId,
      accessTokenEnc,
      refreshTokenEnc: refreshTokenEnc ?? encryptToken(''),
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      googleEmail: input.googleEmail,
      calendarId,
      lastSyncedAt: new Date(),
      lastError: null,
    },
    update: {
      accessTokenEnc,
      ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      googleEmail: input.googleEmail,
      calendarId,
      lastError: null,
    },
  });
}

/** מחיקת חיבור (ניתוק). אידמפוטנטי. */
export async function deleteConnection(staffId: string): Promise<void> {
  await prisma.staffCalendarConnection.deleteMany({ where: { staffId } });
}

/** עדכון מתגי סנכרון (ייבוא עומס / ייצוא תורים). */
export async function setConnectionToggles(
  staffId: string,
  toggles: { importBusy?: boolean; exportBookings?: boolean },
) {
  return prisma.staffCalendarConnection.update({
    where: { staffId },
    data: {
      ...(toggles.importBusy !== undefined ? { importBusy: toggles.importBusy } : {}),
      ...(toggles.exportBookings !== undefined ? { exportBookings: toggles.exportBookings } : {}),
    },
  });
}

/** רישום שגיאת סנכרון אחרונה (best-effort, לא זורק). */
export async function recordSyncError(staffId: string, message: string): Promise<void> {
  try {
    await prisma.staffCalendarConnection.update({
      where: { staffId },
      data: { lastError: message.slice(0, 500) },
    });
  } catch {
    // התמדת אבחון בלבד — לא מפילים את הזרימה.
  }
}

/** רישום סנכרון מוצלח (מנקה שגיאה, מעדכן זמן). */
export async function recordSyncOk(staffId: string): Promise<void> {
  try {
    await prisma.staffCalendarConnection.update({
      where: { staffId },
      data: { lastSyncedAt: new Date(), lastError: null },
    });
  } catch {
    // best-effort.
  }
}

export type ConnectionRow = NonNullable<Awaited<ReturnType<typeof getConnectionByStaffId>>>;

/**
 * מחזיר access token תקף לחיבור: משתמש בטוקן הקיים אם לא פקע, אחרת מרענן דרך
 * refresh token ומתמיד את הטוקן החדש. מחזיר null אם אין refresh token או שהרענון נכשל.
 */
export async function getFreshAccessToken(conn: ConnectionRow): Promise<string | null> {
  const now = Date.now();
  const expiresAt = conn.accessTokenExpiresAt?.getTime() ?? 0;

  if (expiresAt - EXPIRY_BUFFER_MS > now) {
    try {
      return decryptToken(conn.accessTokenEnc);
    } catch {
      // ימשיך לרענון.
    }
  }

  let refreshToken: string;
  try {
    refreshToken = decryptToken(conn.refreshTokenEnc);
  } catch {
    return null;
  }
  if (!refreshToken) return null;

  try {
    const tok = await refreshAccessToken(refreshToken);
    const newExpiry = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000);
    await prisma.staffCalendarConnection.update({
      where: { staffId: conn.staffId },
      data: {
        accessTokenEnc: encryptToken(tok.access_token),
        accessTokenExpiresAt: newExpiry,
        ...(tok.refresh_token ? { refreshTokenEnc: encryptToken(tok.refresh_token) } : {}),
        lastError: null,
      },
    });
    return tok.access_token;
  } catch (err) {
    await recordSyncError(conn.staffId, `refresh_failed:${(err as Error).message}`);
    return null;
  }
}

/**
 * מאתר/מבטיח את איש הצוות של הבעלים ומחזיר את מזההו — לצורך זרימת החיבור.
 * הבעלים מזוהה במייל (ownerEmail), בהתאם ל-ensureOwnerStaffMember.
 */
export async function resolveOwnerStaffId(business: {
  id: string;
  ownerEmail: string;
  name?: string | null;
  ownerName?: string | null;
}): Promise<string> {
  const { id } = await ensureOwnerStaffMember(business.id, {
    ownerEmail: business.ownerEmail,
    ownerName: business.ownerName ?? null,
    businessName: business.name ?? null,
  });
  return id;
}
