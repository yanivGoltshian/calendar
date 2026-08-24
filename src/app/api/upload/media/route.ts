import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { BlobServiceClient } from '@azure/storage-blob';
import { auth } from '@/auth';
import { getBusinessesOwnedByEmail } from '@/server/repos/business';
import { validateMediaFile } from './validate';

export const dynamic = 'force-dynamic';

// אחסון משותף עם סרטוני ראש-העמוד: אותו container ציבורי, ללא משאב או secret חדש.
const CONTAINER = 'hero-videos';

/**
 * העלאת מדיה כללית (תמונה או סרטון) מהמכשיר לאחסון blob ציבורי, לשימוש עורך הפרימיום.
 *
 * שער בעלות נאכף כאן במפורש (route handler אינו עובר דרך admin/layout): מאמתים
 * session + בעלות במייל, וכל שגיאה מוחזרת כ-JSON בעברית. סוג וגודל הקובץ נבדקים
 * דרך `validateMediaFile` (תמונות עד 8MB, סרטונים עד 30MB). הקובץ נשמר תחת מפתח
 * ייחודי לפי מזהה העסק, וה-URL הציבורי מוחזר לשמירה בטיוטה.
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
      { error: 'העלאת מדיה אינה זמינה כרגע.' },
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

  const check = validateMediaFile({ type: file.type, size: file.size });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const service = BlobServiceClient.fromConnectionString(connection);
    const container = service.getContainerClient(CONTAINER);
    const blobName = `media/${business.id}-${randomUUID()}.${check.ext}`;
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
