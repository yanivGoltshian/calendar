/** Normalize Israeli phone input to E.164 without server-only dependencies. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+972')) return digits;
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return digits.startsWith('+') ? digits : `+972${digits}`;
}
