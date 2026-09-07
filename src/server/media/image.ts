import sharp from 'sharp';
import { MAX_SOURCE_IMAGE_BYTES, MAX_RENDERED_IMAGE_BYTES } from '@/lib/media';

const MAX_INPUT_PIXELS = 20_000_000;
const MAX_LEGACY_JPEG_PIXELS = 32_000_000;
const MAX_LEGACY_DIMENSION = 1280;
const legacyWaiting: (() => void)[] = [];
let legacyActive = false;

async function renderLegacy(load: () => Promise<Buffer>): Promise<Buffer> {
  // Also bound callers outside the public image cache, including OG rendering.
  if (legacyActive) {
    if (legacyWaiting.length >= 3) throw new Error('image_busy');
    await new Promise<void>((resolve, reject) => {
      const start = () => { clearTimeout(timeout); resolve(); };
      const timeout = setTimeout(() => {
        const index = legacyWaiting.indexOf(start);
        if (index >= 0) legacyWaiting.splice(index, 1);
        reject(new Error('image_busy'));
      }, 12_000);
      legacyWaiting.push(start);
    });
  } else {
    legacyActive = true;
  }
  try {
    return await load();
  } finally {
    const next = legacyWaiting.shift();
    if (next) next();
    else legacyActive = false;
  }
}

async function optimize(input: Buffer, width: number, allowLegacyJpeg: boolean): Promise<Buffer> {
  if (!input.length || input.length > MAX_SOURCE_IMAGE_BYTES) throw new Error('image_size');
  if (!Number.isInteger(width) || width <= 0) throw new Error('image_width');
  const options = {
    limitInputPixels: allowLegacyJpeg ? MAX_LEGACY_JPEG_PIXELS : MAX_INPUT_PIXELS,
    animated: false,
    sequentialRead: true,
  };
  const metadata = await sharp(input, options).metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) {
    throw new Error('image_format');
  }
  const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
  const legacy = pixels > MAX_INPUT_PIXELS;
  if (!pixels || (legacy && (!allowLegacyJpeg || metadata.format !== 'jpeg'))) {
    throw new Error('image_pixels');
  }
  const renderOptions = { ...options, limitInputPixels: legacy ? MAX_LEGACY_JPEG_PIXELS : MAX_INPUT_PIXELS };
  const render = async () => {
    for (const [quality, maximum] of [[78, 1600], [60, 1600], [50, 960], [50, 640]]) {
      // Above 20MP, 1280px guarantees at least 2x JPEG decoder shrink on each
      // axis, including Sharp's rounding fallback. Keep pre-resize operations
      // limited to EXIF auto-orientation so shrink-on-load remains available.
      const bound = legacy ? Math.min(maximum, MAX_LEGACY_DIMENSION) : maximum;
      const output = await sharp(input, renderOptions).rotate()
        .resize({ width: Math.min(width, bound), height: bound, fit: 'inside', withoutEnlargement: true, fastShrinkOnLoad: true })
        .timeout({ seconds: 5 }).webp({ quality, effort: 3 }).toBuffer();
      if (output.length <= MAX_RENDERED_IMAGE_BYTES) return output;
    }
    throw new Error('image_output_budget');
  };
  return legacy ? renderLegacy(render) : render();
}

export function optimizeImage(input: Buffer, width = 1600): Promise<Buffer> {
  return optimize(input, width, true);
}

export function optimizeUploadImage(input: Buffer): Promise<Buffer> {
  return optimize(input, 1600, false);
}
