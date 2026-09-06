/**
 * Offline only: no database/storage credentials, no network calls.
 * node --import tsx scripts/legacy-media-backfill.ts ./fixture.json [--write]
 */
import { readFile, mkdir, writeFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { decodeLegacyImage, legacyImageHash } from '../src/server/media/publicContent';
import { optimizeImage } from '../src/server/media/image';

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath || path.isAbsolute(inputPath) || inputPath.split(path.sep).includes('..')) throw new Error('Use a reviewed JSON fixture relative to the checkout.');
  if (process.env.NODE_ENV === 'production') throw new Error('Production execution is prohibited.');
  const resolved = await realpath(inputPath);
  if (!resolved.startsWith(`${await realpath('.')}${path.sep}`) || path.extname(resolved) !== '.json') throw new Error('JSON fixtures must remain inside this checkout.');
  if ((await stat(resolved)).size > 64 * 1024 * 1024) throw new Error('Fixture exceeds 64 MiB; split the reviewed export first.');
  const write = process.argv.includes('--write');
  const document = JSON.parse(await readFile(resolved, 'utf8'));
  const assets = new Map<string, string>();
  async function visit(value: unknown): Promise<unknown> {
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      const hash = legacyImageHash(value);
      if (assets.has(hash)) return assets.get(hash);
      const decoded = decodeLegacyImage(value);
      if (!decoded) throw new Error('Invalid or oversized legacy image; source remains unchanged.');
      const image = await optimizeImage(decoded);
      const url = `/brand/migrated/${hash}.webp`;
      assets.set(hash, url);
      if (write) {
        await mkdir('public/brand/migrated', { recursive: true });
        await writeFile(`public${url}`, image, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'EEXIST') throw error;
        });
        if (!(await readFile(`public${url}`)).equals(image)) throw new Error('Existing asset differs; review it manually before continuing.');
      }
      return url;
    }
    if (Array.isArray(value)) {
      const output: unknown[] = [];
      for (const item of value) output.push(await visit(item));
      return output;
    }
    if (value && typeof value === 'object') {
      const output: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) output[key] = await visit(child);
      return output;
    }
    return value;
  }
  const result = await visit(document);
  if (write) {
    await mkdir('.session-scratch/media-backfill', { recursive: true });
    await writeFile('.session-scratch/media-backfill/result.json', JSON.stringify(result, null, 2), { flag: 'wx' });
  }
  console.log(JSON.stringify({ mode: write ? 'offline-write' : 'dry-run', uniqueImages: assets.size, databaseMutations: 0 }));
}

void main().catch((error) => { console.error(error.message); process.exitCode = 1; });
