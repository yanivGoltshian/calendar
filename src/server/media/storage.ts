import { createHash } from 'node:crypto';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { prisma } from '@/lib/db';
import { getBusinessAccess } from '@/server/subscription';
import { assertMediaQuota, MediaError, mediaQuota } from './uploadPolicy';
import { businessOwnerWhere } from '@/lib/businessOwnerIdentity';

export const MEDIA_CONTAINER = 'hero-videos';
export const MEDIA_PREFIXES = (businessId: string) => [
  `media/${businessId}/`,
  `media/${businessId}-`,
  `hero/${businessId}-`,
];
const MEDIA_DRAFT_GRACE_MS = 24 * 60 * 60 * 1000;

export type MediaStorage = {
  getBlockBlobClient: (key: string) => {
    url: string;
    exists: (options: { abortSignal: AbortSignal }) => Promise<boolean>;
    deleteIfExists?: (options: { abortSignal: AbortSignal }) => Promise<unknown>;
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
  }) => AsyncIterable<{ name?: string; properties: { contentLength?: number; lastModified?: Date } }>;
};

function stringsFromArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function landingMediaValues(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const landing = value as Record<string, unknown>;
  const beforeAfter = Array.isArray(landing.beforeAfter) ? landing.beforeAfter : [];
  const hotDeals = landing.hotDeals && typeof landing.hotDeals === 'object' && !Array.isArray(landing.hotDeals)
    ? landing.hotDeals as Record<string, unknown>
    : null;
  return [
    typeof landing.heroVideoUrl === 'string' ? landing.heroVideoUrl : null,
    typeof landing.heroPosterUrl === 'string' ? landing.heroPosterUrl : null,
    ...stringsFromArray(landing.heroImages),
    ...stringsFromArray(landing.galleryImageUrls),
    ...beforeAfter.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const pair = item as Record<string, unknown>;
      return [pair.beforeUrl, pair.afterUrl].filter((media): media is string => typeof media === 'string');
    }),
    ...stringsFromArray(hotDeals?.images),
  ].filter((media): media is string => typeof media === 'string');
}

function mediaKeyFromUrl(value: string, businessId: string): string | null {
  try {
    const url = new URL(value, 'https://torchick.local');
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const candidates = pathname.startsWith(`${MEDIA_CONTAINER}/`)
      ? [pathname.slice(MEDIA_CONTAINER.length + 1)]
      : [pathname];
    return candidates.find((key) => MEDIA_PREFIXES(businessId).some((prefix) => key.startsWith(prefix))) ?? null;
  } catch {
    return null;
  }
}

export function publishedMediaKeysForBusiness(
  businessId: string,
  media: { logoUrl?: string | null; coverImageUrl?: string | null; landingContent?: unknown },
): Set<string> {
  const publishedKeys = new Set<string>();
  const publishedValues = [
    media.logoUrl,
    media.coverImageUrl,
    ...landingMediaValues(media.landingContent),
  ];
  for (const value of publishedValues) {
    if (!value) continue;
    const key = mediaKeyFromUrl(value, businessId);
    if (key) publishedKeys.add(key);
  }
  return publishedKeys;
}

export type MediaUsageSummary = {
  usedBytes: number;
  usedObjects: number;
  unusedBytes: number;
  unusedObjects: number;
};

async function mediaUsageForPublishedKeys(
  businessId: string,
  publishedKeys: Set<string>,
  container: MediaStorage,
  abortSignal: AbortSignal,
  deleteUnused = false,
  unknownByteSize = 0,
  countRecentDrafts = false,
): Promise<MediaUsageSummary> {
  const summary: MediaUsageSummary = {
    usedBytes: 0,
    usedObjects: 0,
    unusedBytes: 0,
    unusedObjects: 0,
  };
  for (const prefix of MEDIA_PREFIXES(businessId)) {
    for await (const asset of container.listBlobsFlat({ prefix, abortSignal })) {
      if (!asset.name) continue;
      const bytes = asset.properties.contentLength ?? unknownByteSize;
      const isRecentDraft =
        countRecentDrafts &&
        (!asset.properties.lastModified ||
          Date.now() - asset.properties.lastModified.getTime() < MEDIA_DRAFT_GRACE_MS);
      if (publishedKeys.has(asset.name) || isRecentDraft) {
        summary.usedBytes += bytes;
        summary.usedObjects++;
        continue;
      }
      summary.unusedBytes += bytes;
      summary.unusedObjects++;
      if (deleteUnused) {
        const blob = container.getBlockBlobClient(asset.name);
        if (!blob.deleteIfExists) throw new MediaError('ניקוי מדיה אינו זמין כרגע.', 503);
        await blob.deleteIfExists({ abortSignal });
      }
    }
  }
  return summary;
}

export async function cleanupUnusedBusinessMedia(
  businessId: string,
  container: MediaStorage = mediaContainer(),
): Promise<MediaUsageSummary> {
  const abortSignal = AbortSignal.timeout(30_000);
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { logoUrl: true, coverImageUrl: true, landingContent: true },
  });
  if (!business) throw new MediaError('העסק לא נמצא.', 404);
  return mediaUsageForPublishedKeys(
    businessId,
    publishedMediaKeysForBusiness(businessId, business),
    container,
    abortSignal,
    true,
  );
}

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
  authorizedImpersonationId: string | null = null,
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
          // The upload route obtains this ID only from the signed, admin-authorized cookie gate.
          ...(authorizedImpersonationId === businessId ? {} : businessOwnerWhere(ownerEmail)),
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
      const publishedKeys = publishedMediaKeysForBusiness(businessId, {
        logoUrl: business.logoUrl,
        coverImageUrl: business.coverImageUrl,
        landingContent: business.landingContent,
      });
      const used = await mediaUsageForPublishedKeys(
        businessId,
        publishedKeys,
        container,
        abortSignal,
        false,
        mediaQuota(business.plan).bytes,
        true,
      );
      assertMediaQuota(
        business.plan,
        { bytes: used.usedBytes, objects: used.usedObjects },
        input.length,
      );
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
