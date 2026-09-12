import { createHmac } from 'node:crypto';

function watermarkSecret(env: Record<string, string | undefined>): string {
  const secret =
    env.WATERMARK_AUDIT_SECRET ??
    env.SESSION_SECRET ??
    env.AUTH_SECRET ??
    env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('watermark_audit_secret_missing');
  return secret;
}

export function createWatermarkAuditId(
  subject: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const normalized = subject.trim().toLowerCase();
  if (!normalized) throw new Error('watermark_subject_missing');
  return createHmac('sha256', watermarkSecret(env))
    .update(`sensitive-screen:${normalized}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
}
