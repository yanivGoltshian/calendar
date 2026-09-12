const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;

function decodings(value: string): string[] {
  const values = [value];
  for (let index = 0; index < 2; index += 1) {
    try {
      const decoded = decodeURIComponent(values[values.length - 1]);
      if (decoded === values[values.length - 1]) break;
      values.push(decoded);
    } catch {
      return [];
    }
  }
  return values;
}

export function isSafeInternalRedirect(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || CONTROL_OR_BACKSLASH.test(value)) {
    return false;
  }

  const candidates = decodings(value);
  if (candidates.length === 0) return false;

  return candidates.every((candidate) => {
    if (
      !candidate.startsWith('/') ||
      candidate.startsWith('//') ||
      CONTROL_OR_BACKSLASH.test(candidate)
    ) {
      return false;
    }
    const resolved = new URL(candidate, 'https://torchick.invalid');
    return resolved.origin === 'https://torchick.invalid';
  });
}

export function safeInternalRedirect(
  value: string | null | undefined,
  fallback: `/${string}`,
): string {
  return value && isSafeInternalRedirect(value) ? value : fallback;
}
