import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { storeBusinessMedia } from '@/server/media/storage';
import { optimizeUploadImage } from '@/server/media/image';
import { validVideoSignature } from '@/server/media/uploadPolicy';
import {
  fetchPublicImage,
  fetchPublicVideo,
  type BusinessImportFetch,
  type BusinessImportNetworkOptions,
} from './network';
import type { BusinessImportWarning } from './types';
import type { ImportedMediaCandidates } from './mapDraft';

export interface ImportedOwnedMedia {
  logoUrl: string | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  heroVideoUrl?: string | null;
  staffAvatarUrls?: Record<string, string>;
  assets?: Array<{
    role: MediaRole;
    sourceUrl: string;
    storedUrl: string;
    width?: number;
    height?: number;
    contentType: string;
  }>;
  warnings: BusinessImportWarning[];
}

export interface ImportBusinessMediaDependencies {
  fetchImpl?: BusinessImportFetch;
  networkOptions?: BusinessImportNetworkOptions;
  storageConfigured?: () => boolean;
  optimize?: typeof optimizeUploadImage;
  store?: typeof storeBusinessMedia;
  inspectImage?: (
    input: Buffer,
  ) => Promise<{ width?: number; height?: number; format?: string }>;
}

type MediaRole = 'logo' | 'cover' | 'gallery' | 'video' | `staff:${string}`;

function canonicalCandidateKey(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid|oh|_nc_.+|ccb|stp|efg)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.pathname = url.pathname
      .replace(/\/opt\//, '/')
      .replace(/-(?:\d+)[wh](?=\.[a-z0-9]+$)/i, '');
    return url.href;
  } catch {
    return value;
  }
}

function videoExtension(contentType: string): string {
  if (contentType === 'video/webm') return 'webm';
  if (contentType === 'video/quicktime') return 'mov';
  if (contentType === 'video/x-m4v') return 'm4v';
  return 'mp4';
}

export async function importBusinessMedia(
  businessId: string,
  ownerEmail: string | null,
  candidates: ImportedMediaCandidates,
  dependencies: ImportBusinessMediaDependencies = {},
): Promise<ImportedOwnedMedia> {
  const warnings: BusinessImportWarning[] = [];
  const urls: Array<{ role: MediaRole; url: string }> = [
    ...(candidates.logoUrl ? [{ role: 'logo' as const, url: candidates.logoUrl }] : []),
    ...(candidates.coverImageUrl
      ? [{ role: 'cover' as const, url: candidates.coverImageUrl }]
      : []),
    ...candidates.galleryImageUrls.slice(0, 8).map((url) => ({
      role: 'gallery' as const,
      url,
    })),
    ...(candidates.videoUrls ?? []).slice(0, 1).map((url) => ({
      role: 'video' as const,
      url,
    })),
    ...(candidates.staffImages ?? []).slice(0, 10).map(({ staffKey, url }) => ({
      role: `staff:${staffKey}` as const,
      url,
    })),
  ];

  if (urls.length === 0) {
    return {
      logoUrl: null,
      coverImageUrl: null,
      galleryImageUrls: [],
      heroVideoUrl: null,
      staffAvatarUrls: {},
      assets: [],
      warnings,
    };
  }
  if (
    !(
      dependencies.storageConfigured ??
      (() => Boolean(process.env.MEDIA_STORAGE_CONNECTION))
    )()
  ) {
    warnings.push({
      code: 'media-storage-unavailable',
      message:
        'Public image URLs were found, but media storage is unavailable. External URLs were not saved.',
    });
    return {
      logoUrl: null,
      coverImageUrl: null,
      galleryImageUrls: [],
      heroVideoUrl: null,
      staffAvatarUrls: {},
      assets: [],
      warnings,
    };
  }

  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const optimize = dependencies.optimize ?? optimizeUploadImage;
  const store = dependencies.store ?? storeBusinessMedia;
  const inspectImage =
    dependencies.inspectImage ??
    ((input: Buffer) => sharp(input, { animated: false }).metadata());
  const stored: NonNullable<ImportedOwnedMedia['assets']> = [];
  const resolved: Array<{ role: MediaRole; storedUrl: string }> = [];
  const storedByDigest = new Map<string, string>();
  const storedByCandidate = new Map<
    string,
    Omit<NonNullable<ImportedOwnedMedia['assets']>[number], 'role' | 'sourceUrl'>
  >();

  for (const candidate of urls) {
    try {
      if (!ownerEmail)
        throw new Error('Business owner email is required for media storage.');
      const candidateKey = `${candidate.role === 'video' ? 'video' : 'image'}:${canonicalCandidateKey(candidate.url)}`;
      const cached = storedByCandidate.get(candidateKey);
      if (cached) {
        resolved.push({ role: candidate.role, storedUrl: cached.storedUrl });
        continue;
      }
      if (candidate.role === 'video') {
        const video = await fetchPublicVideo(
          candidate.url,
          fetchImpl,
          dependencies.networkOptions,
        );
        if (!validVideoSignature(video.bytes, video.contentType)) {
          throw new Error('video_signature');
        }
        const digest = createHash('sha256').update(video.bytes).digest('hex');
        const url =
          storedByDigest.get(digest) ??
          (await store(
            businessId,
            ownerEmail,
            video.bytes,
            video.contentType,
            videoExtension(video.contentType),
          ));
        storedByDigest.set(digest, url);
        const asset = {
          storedUrl: url,
          contentType: video.contentType,
        };
        storedByCandidate.set(candidateKey, asset);
        stored.push({ role: candidate.role, sourceUrl: candidate.url, ...asset });
        resolved.push({ role: candidate.role, storedUrl: asset.storedUrl });
        continue;
      }
      const image = await fetchPublicImage(
        candidate.url,
        fetchImpl,
        dependencies.networkOptions,
      );
      const metadata = await inspectImage(image.bytes);
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (width < 96 || height < 96 || width * height < 40_000) {
        throw new Error('image_dimensions');
      }
      const optimized = await optimize(image.bytes);
      const digest = createHash('sha256').update(optimized).digest('hex');
      const url =
        storedByDigest.get(digest) ??
        (await store(businessId, ownerEmail, optimized, 'image/webp', 'webp'));
      storedByDigest.set(digest, url);
      const asset = {
        storedUrl: url,
        width,
        height,
        contentType: 'image/webp',
      };
      storedByCandidate.set(candidateKey, asset);
      stored.push({ role: candidate.role, sourceUrl: candidate.url, ...asset });
      resolved.push({ role: candidate.role, storedUrl: asset.storedUrl });
    } catch (error) {
      warnings.push({
        code:
          error instanceof Error &&
          (error.message === 'image_dimensions' || error.message === 'video_signature')
            ? 'media-rejected'
            : 'media-fetch-failed',
        message: `A public ${candidate.role} media item could not be copied into business-owned media.`,
        sourceUrl: candidate.url,
      });
    }
  }

  const uniqueStored = (role: MediaRole) => [
    ...new Set(
      resolved.filter((asset) => asset.role === role).map((asset) => asset.storedUrl),
    ),
  ];
  return {
    logoUrl: uniqueStored('logo')[0] ?? null,
    coverImageUrl: uniqueStored('cover')[0] ?? null,
    galleryImageUrls: uniqueStored('gallery').filter(
      (url) => url !== uniqueStored('logo')[0] && url !== uniqueStored('cover')[0],
    ),
    heroVideoUrl: uniqueStored('video')[0] ?? null,
    staffAvatarUrls: Object.fromEntries(
      resolved
        .filter((asset): asset is typeof asset & { role: `staff:${string}` } =>
          asset.role.startsWith('staff:'),
        )
        .map((asset) => [asset.role.slice('staff:'.length), asset.storedUrl]),
    ),
    assets: stored,
    warnings,
  };
}
