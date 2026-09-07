const MAX_ENTRIES = 96;
const MAX_BYTES = 24 * 1024 * 1024;
const entries = new Map<string, { image: Buffer; until: number }>();
const pending = new Map<string, Promise<Buffer>>();
const waiting: (() => void)[] = [];
let active = 0;
let bytes = 0;

async function render(load: () => Promise<Buffer>) {
  if (active >= 2) await new Promise<void>((resolve, reject) => {
    const start = () => { clearTimeout(timeout); resolve(); };
    const timeout = setTimeout(() => {
      const index = waiting.indexOf(start);
      if (index >= 0) waiting.splice(index, 1);
      reject(new Error('image_busy'));
    }, 12_000);
    waiting.push(start);
  });
  else active++;
  try {
    return await load();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

/** Bounded per-process cache and coalescing; edge caching is still recommended. */
export async function cachedImage(key: string, load: () => Promise<Buffer>): Promise<Buffer> {
  const entry = entries.get(key);
  if (entry && entry.until > Date.now()) return entry.image;
  if (entry) { entries.delete(key); bytes -= entry.image.length; }
  const inflight = pending.get(key);
  if (inflight) return inflight;
  if (pending.size >= 26) throw new Error('image_busy');
  const result = render(load).then((image) => {
    if (image.length > MAX_BYTES) return image;
    while (entries.size && (entries.size >= MAX_ENTRIES || bytes + image.length > MAX_BYTES)) {
      const oldest = entries.keys().next().value!;
      bytes -= entries.get(oldest)!.image.length;
      entries.delete(oldest);
    }
    entries.set(key, { image, until: Date.now() + 3600_000 });
    bytes += image.length;
    return image;
  }).finally(() => pending.delete(key));
  pending.set(key, result);
  return result;
}
