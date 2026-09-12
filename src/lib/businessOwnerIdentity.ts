import type { Prisma } from '@prisma/client';
import { normalizeEmail } from './crypto';
import { isPhoneOwnerEmail } from './ownerPhoneIdentity';

type OwnerIdentity = {
  ownerEmail?: string | null;
  ownerPhoneIdentity?: string | null;
};

export function isBusinessOwnerIdentity(email: string | null | undefined, business: OwnerIdentity): boolean {
  if (!email?.trim()) return false;
  const identity = normalizeEmail(email);
  return identity === normalizeEmail(business.ownerEmail ?? '') ||
    (isPhoneOwnerEmail(identity) && identity === business.ownerPhoneIdentity);
}

// Only an authenticated owner identity may be passed here, never a submitted contact.
export function businessOwnerWhere(email: string): Prisma.BusinessWhereInput {
  const identity = normalizeEmail(email);
  if (!identity) return { id: { in: [] } };
  return {
    OR: [
      { ownerEmail: { equals: identity, mode: 'insensitive' } },
      ...(isPhoneOwnerEmail(identity) ? [{ ownerPhoneIdentity: identity }] : []),
    ],
  };
}
