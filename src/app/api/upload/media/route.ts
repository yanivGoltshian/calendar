import { uploadMedia } from '@/server/media/upload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  return uploadMedia(request);
}
