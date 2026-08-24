import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { BlobServiceClient } from '@azure/storage-blob';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';

export const dynamic = 'force-dynamic';

// גודל מרבי לסרטון ראש-העמוד: 30MB. סוגים מותרים: mp4, webm.
const MAX_BYTES = 30 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
const CONTAINER = 'hero-videos';

/**
 * העלאת סרטון תדמית קצר לראש-העמוד מהמכשיר, לאחסון blob ציבורי.
 *
 * שער בעלות נאכף כאן במפורש (route handler אינו עובר דרך admin/layout): מאמתים
 * session + בעלות במייל, וכל שגיאה מוחזרת כ-JSON בעברית. הקובץ נשמר תחת מפתח
 * ייחודי לפי מזהה העסק, וה-URL הציבורי מוחזר לשמירה כ-heroVideoUrl.
 */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: 'נדרשת התחברות.' }, { status: 401 });
  }

  const [business] = await getBusinessesOwnedByEmail(email);
  if (!business) {
    return NextResponse.json({ error: 'אין הרשאה.' }, { status: 403 });
  }

  const connection = process.env.MEDIA_STORAGE_CONNECTION;
  if (!connection) {
    return NextResponse.json(
      { error: 'העלאת סרטונים אינה זמינה כרגע.' },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'בקשה לא תקינה.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'לא נבחר קובץ.' }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: 'אפשר להעלות רק קובץ mp4 או webm.' },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'הקובץ גדול מדי. אפשר עד 30MB.' },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const service = BlobServiceClient.fromConnectionString(connection);
    const container = service.getContainerClient(CONTAINER);
    const blobName = `hero/${business.id}-${randomUUID()}.${ext}`;
    const blob = container.getBlockBlobClient(blobName);
    await blob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.type },
    });
    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json(
      { error: 'אירעה תקלה בהעלאה. אפשר לנסות שוב.' },
      { status: 500 },
    );
  }
}
