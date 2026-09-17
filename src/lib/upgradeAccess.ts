import { isBusinessOwnerIdentity } from './businessOwnerIdentity';

export type UpgradeBusinessIdentity = {
  id: string;
  name: string;
  ownerEmail?: string | null;
  ownerPhoneIdentity?: string | null;
  phone?: string | null;
};

export type UpgradeAccessMode = 'owner' | 'platform-impersonation';

export type UpgradeAccessContext<TBusiness extends UpgradeBusinessIdentity> = {
  actor: {
    email: string;
    name: string | null;
  };
  business: TBusiness;
  mode: UpgradeAccessMode;
};

export type UpgradeContactDefaults = {
  name: string;
  email: string;
  phone: string;
};

export function resolveUpgradeAccessMode({
  actorEmail,
  business,
  validatedImpersonatedBusinessId,
}: {
  actorEmail: string;
  business: UpgradeBusinessIdentity;
  validatedImpersonatedBusinessId: string | null;
}): UpgradeAccessMode | null {
  if (validatedImpersonatedBusinessId === business.id) {
    return 'platform-impersonation';
  }
  return isBusinessOwnerIdentity(actorEmail, business) ? 'owner' : null;
}

export function getUpgradeContactDefaults<TBusiness extends UpgradeBusinessIdentity>(
  context: UpgradeAccessContext<TBusiness>,
): UpgradeContactDefaults {
  if (context.mode === 'platform-impersonation') {
    return {
      name: context.business.name,
      email: context.business.ownerEmail?.trim() || '',
      phone: context.business.phone?.trim() || '',
    };
  }

  return {
    name: context.actor.name || context.business.name,
    email: context.actor.email,
    phone: context.business.phone?.trim() || '',
  };
}
