import { countListedBusinesses } from '@/server/repos/publicDirectory';
import { shouldShowDirectoryLink } from '@/lib/directory';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const count = await countListedBusinesses();
    return Response.json({ visible: shouldShowDirectoryLink(count) }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('directory_status_failed', { error: error instanceof Error ? error.name : 'unknown' });
    return Response.json({ visible: false }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
