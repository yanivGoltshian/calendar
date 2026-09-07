import { createHash } from 'node:crypto';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { prisma } from '@/lib/db';
import { getBusinessAccess } from '@/server/subscription';
import { assertMediaQuota, MediaError, mediaQuota } from './uploadPolicy';

export const MEDIA_CONTAINER = 'hero-videos';
export const MEDIA_PREFIXES = (businessId: string) => [
  `media/${businessId}/`,
  `media/${businessId}-`,
  `hero/${businessId}-`,
];

export type MediaStorage = {
  getBlockBlobClient: (key: string) => {
    url: string;
    exists: (options: { abortSignal: AbortSignal }) => Promise<boolean>;
    uploadData: (
      input: Buffer,
      options: {
        abortSignal: AbortSignal;
        conditions: { ifNoneMatch: string };
        blobHTTPHeaders: { blobContentType: string; blobCacheControl: string };
      },
    ) => Promise<unknown>;
  };
  listBlobsFlat: (options: {
    prefix: string;
    abortSignal: AbortSignal;
  }) => AsyncIterable<{ properties: { contentLength?: number } }>;
};

export function mediaContainer(): ContainerClient {
  const connection = process.env.MEDIA_STORAGE_CONNECTION;
  if (!connection) throw new MediaError('העלאת מדיה אינה זמינה כרגע.', 503);
  return BlobServiceClient.fromConnectionString(connection).getContainerClient(
    MEDIA_CONTAINER,
  );
}

export async function storeBusinessMedia(
  businessId: string,
  ownerEmail: string,
  input: Buffer,
  type: string,
  ext: string,
  container: MediaStorage = mediaContainer(),
) {
  const digest = createHash('sha256').update(input).digest('hex');
  const key = `media/${businessId}/${digest}.${ext}`;
  const blob = container.getBlockBlobClient(key);
  const abortSignal = AbortSignal.timeout(15_000);
  // The row lock serializes quota checks across replicas and lifecycle changes.
  // Blob listings also count unsaved editor drafts/old upload keys, not only DB references.
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Business" WHERE "id" = ${businessId} FOR UPDATE`;
      const business = await tx.business.findFirst({
        where: {
          id: businessId,
          ownerEmail: { equals: ownerEmail.trim(), mode: 'insensitive' },
        },
      });
      if (
        !business ||
        business.accountStatus !== 'ACTIVE' ||
        !getBusinessAccess(business).active
      ) {
        throw new MediaError('המנוי אינו פעיל להעלאת מדיה.', 403);
      }
      if (await blob.exists({ abortSignal })) return blob.url;
      const used = { bytes: 0, objects: 0 };
      for (const prefix of MEDIA_PREFIXES(businessId)) {
        for await (const asset of container.listBlobsFlat({ prefix, abortSignal })) {
          used.bytes += asset.properties.contentLength ?? mediaQuota(business.plan).bytes;
          used.objects++;
          assertMediaQuota(business.plan, used, input.length);
        }
      }
      assertMediaQuota(business.plan, used, input.length);
      await blob.uploadData(input, {
        abortSignal,
        conditions: { ifNoneMatch: '*' },
        blobHTTPHeaders: {
          blobContentType: type,
          blobCacheControl: 'public, max-age=31536000, immutable',
        },
      });
      // A failed DB commit after upload is intentionally charged on the next listing.
      return blob.url;
    },
    { timeout: 20_000, maxWait: 5000 },
  );
}
