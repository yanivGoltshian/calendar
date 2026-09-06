export class MediaError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export function mediaQuota(plan: string): { bytes: number; objects: number } {
  return plan === 'exclusive' ? { bytes: 300 * 1024 * 1024, objects: 200 } :
    plan === 'premium' ? { bytes: 150 * 1024 * 1024, objects: 100 } :
      { bytes: 30 * 1024 * 1024, objects: 30 };
}

export function assertMediaQuota(plan: string, used: { bytes: number; objects: number }, addedBytes: number) {
  const limit = mediaQuota(plan);
  if (used.bytes + addedBytes > limit.bytes || used.objects + 1 > limit.objects) {
    throw new MediaError('מכסת המדיה מלאה. יש לפנות קבצים שאינם בשימוש לפני העלאה נוספת.', 413);
  }
}

export async function boundedFormData(request: Request, maxBytes: number): Promise<FormData> {
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) throw new MediaError('הקובץ גדול מדי.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new MediaError('בקשה לא תקינה.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel(); }, 15_000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw new MediaError('ההעלאה ארכה זמן רב מדי.', 408);
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        await reader.cancel();
        throw new MediaError('הקובץ גדול מדי.', 413);
      }
      chunks.push(value);
    }
    return await new Request(request.url, { method: 'POST', headers: request.headers, body: Buffer.concat(chunks) }).formData();
  } finally { clearTimeout(timeout); reader.releaseLock(); }
}

export function validVideoSignature(input: Buffer, type: string): boolean {
  return type === 'video/webm'
    ? input.length >= 4 && input.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : input.length >= 12 && input.toString('ascii', 4, 8) === 'ftyp';
}
