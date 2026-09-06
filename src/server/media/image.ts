import sharp from 'sharp';
import { MAX_SOURCE_IMAGE_BYTES, MAX_RENDERED_IMAGE_BYTES } from '@/lib/media';

export async function optimizeImage(input: Buffer, width = 1600): Promise<Buffer> {
  if (!input.length || input.length > MAX_SOURCE_IMAGE_BYTES) throw new Error('image_size');
  const options = { limitInputPixels: 20_000_000, animated: false };
  const metadata = await sharp(input, options).metadata();
  if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) {
    throw new Error('image_format');
  }
  for (const [quality, maximum] of [[78, 1600], [60, 1600], [50, 960], [50, 640]]) {
    const output = await sharp(input, options).rotate()
      .resize({ width: Math.min(width, maximum), height: maximum, fit: 'inside', withoutEnlargement: true })
      .timeout({ seconds: 5 }).webp({ quality, effort: 3 }).toBuffer();
    if (output.length <= MAX_RENDERED_IMAGE_BYTES) return output;
  }
  throw new Error('image_output_budget');
}
