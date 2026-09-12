import { storeBusinessMedia } from '@/server/media/storage';
import { optimizeUploadImage } from '@/server/media/image';
import {
  fetchPublicImage,
  type BusinessImportFetch,
  type BusinessImportNetworkOptions,
} from './network';
import type { BusinessImportWarning } from './types';
import type { ImportedMediaCandidates } from './mapDraft';

export interface ImportedOwnedMedia {
  logoUrl: string | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  warnings: BusinessImportWarning[];
}

export interface ImportBusinessMediaDependencies {
  fetchImpl?: BusinessImportFetch;
  networkOptions?: BusinessImportNetworkOptions;
  storageConfigured?: () => boolean;
  optimize?: typeof optimizeUploadImage;
  store?: typeof storeBusinessMedia;
}

type MediaRole = 'logo' | 'cover' | 'gallery';

export async function importBusinessMedia(
  businessId: string,
  ownerEmail: string | null,
  candidates: ImportedMediaCandidates,
  dependencies: ImportBusinessMediaDependencies = {},
): Promise<ImportedOwnedMedia> {
  const warnings: BusinessImportWarning[] = [];
  const urls = [
    ...(candidates.logoUrl ? [{ role: 'logo' as const, url: candidates.logoUrl }] : []),
    ...(candidates.coverImageUrl
      ? [{ role: 'cover' as const, url: candidates.coverImageUrl }]
      : []),
    ...candidates.galleryImageUrls.slice(0, 4).map((url) => ({
      role: 'gallery' as const,
      url,
    })),
  ].filter(
    ({ url }, index, all) =>
      all.findIndex((candidate) => candidate.url === url) === index,
  );

  if (urls.length === 0) {
    return { logoUrl: null, coverImageUrl: null, galleryImageUrls: [], warnings };
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
    return { logoUrl: null, coverImageUrl: null, galleryImageUrls: [], warnings };
  }

  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const optimize = dependencies.optimize ?? optimizeUploadImage;
  const store = dependencies.store ?? storeBusinessMedia;
  const stored: Array<{ role: MediaRole; url: string }> = [];

  for (const candidate of urls) {
    try {
      const image = await fetchPublicImage(
        candidate.url,
        fetchImpl,
        dependencies.networkOptions,
      );
      const optimized = await optimize(image.bytes);
      if (!ownerEmail)
        throw new Error('Business owner email is required for media storage.');
      const url = await store(businessId, ownerEmail, optimized, 'image/webp', 'webp');
      stored.push({ role: candidate.role, url });
    } catch {
      warnings.push({
        code: 'media-fetch-failed',
        message: `A public ${candidate.role} image could not be copied into business-owned media.`,
        sourceUrl: candidate.url,
      });
    }
  }

  return {
    logoUrl: stored.find(({ role }) => role === 'logo')?.url ?? null,
    coverImageUrl: stored.find(({ role }) => role === 'cover')?.url ?? null,
    galleryImageUrls: stored
      .filter(({ role }) => role === 'gallery')
      .map(({ url }) => url),
    warnings,
  };
}
