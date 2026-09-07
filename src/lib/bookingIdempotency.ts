export type BookingAttempt = { fingerprint: string; key: string };
type BookingReceipt = {
  ok: true;
  appointmentId: string;
  status: 'PENDING' | 'CONFIRMED';
};

export function isSuccessfulBookingReceipt(value: unknown): value is BookingReceipt {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Record<string, unknown>;
  return (
    receipt.ok === true &&
    typeof receipt.appointmentId === 'string' &&
    receipt.appointmentId.length > 0 &&
    (receipt.status === 'PENDING' || receipt.status === 'CONFIRMED')
  );
}

/** Keep only the fingerprint and opaque retry key, not another copy of contact details. */
export async function bookingAttemptForPayload(
  previous: BookingAttempt | null,
  body: string,
  identity: string | null,
): Promise<BookingAttempt> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([identity, body])),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, key: crypto.randomUUID() };
}
