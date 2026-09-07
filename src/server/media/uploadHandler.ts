import { getBusinessAccess, type BusinessAccessInput } from '@/server/subscription';
import { validateMediaFile, MAX_VIDEO_BYTES } from '@/app/api/upload/media/validate';
import { boundedFormData, MediaError, validVideoSignature } from './uploadPolicy';
import { optimizeImage } from './image';

type UploadBusiness = BusinessAccessInput & { id: string; accountStatus: string };
type UploadDependencies = {
  email: () => Promise<string | null>;
  business: (email: string) => Promise<UploadBusiness | null>;
  configured: () => boolean;
  store: (
    id: string,
    email: string,
    data: Buffer,
    type: string,
    ext: string,
  ) => Promise<string>;
};
const activeUploads = new Set<string>();

export function createUploadHandler(dependencies: UploadDependencies) {
  return async (request: Request, videoOnly = false): Promise<Response> => {
    let activeId: string | undefined;
    try {
      const email = await dependencies.email();
      if (!email) throw new MediaError('נדרשת התחברות.', 401);
      const business = await dependencies.business(email);
      if (
        !business ||
        business.accountStatus !== 'ACTIVE' ||
        !getBusinessAccess(business).active
      ) {
        throw new MediaError('המנוי אינו פעיל להעלאת מדיה.', 403);
      }
      if (!dependencies.configured())
        throw new MediaError('העלאת מדיה אינה זמינה כרגע.', 503);
      if (activeUploads.has(business.id) || activeUploads.size >= 4) {
        throw new MediaError('מתבצעות העלאות נוספות. יש לנסות שוב בעוד רגע.', 429);
      }
      activeId = business.id;
      activeUploads.add(activeId);
      const form = await boundedFormData(request, MAX_VIDEO_BYTES + 64 * 1024);
      const file = form.get('file');
      if (!(file instanceof File)) throw new MediaError('לא נבחר קובץ.', 400);
      const check = validateMediaFile(file);
      if (!check.ok) throw new MediaError(check.error, check.status);
      if (videoOnly && check.kind !== 'video')
        throw new MediaError('נדרש קובץ סרטון.', 415);
      let input: Buffer = Buffer.from(await file.arrayBuffer());
      let type = file.type;
      let ext = check.ext;
      if (check.kind === 'image') {
        try {
          input = await optimizeImage(input);
        } catch {
          throw new MediaError('התמונה אינה תקינה או חורגת ממגבלת העיבוד.', 415);
        }
        type = 'image/webp';
        ext = 'webp';
      } else if (!validVideoSignature(input, type)) {
        throw new MediaError('תוכן הסרטון אינו תואם לפורמט.', 415);
      }
      const url = await dependencies.store(business.id, email, input, type, ext);
      return Response.json({ url });
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: 'media_upload_denied',
          businessId: activeId,
          status: error instanceof MediaError ? error.status : 500,
        }),
      );
      return Response.json(
        {
          error:
            error instanceof MediaError
              ? error.message
              : 'אירעה תקלה בהעלאה. אפשר לנסות שוב.',
        },
        { status: error instanceof MediaError ? error.status : 500 },
      );
    } finally {
      if (activeId) activeUploads.delete(activeId);
    }
  };
}
