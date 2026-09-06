/** Only absolute HTTP(S) links are allowed in generated email attributes. */
export function safeMessageLink(value: string | null | undefined): string | null {
  if (!value || /[\u0000-\u0020"'<>\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
