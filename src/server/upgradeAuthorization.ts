import { auth } from '@/auth';
import { resolveUpgradeAccessMode, type UpgradeAccessContext } from '@/lib/upgradeAccess';
import { getImpersonatedBusinessId } from '@/server/impersonation';
import { getActiveBusiness } from '@/server/repos/business';

type ActiveBusiness = NonNullable<Awaited<ReturnType<typeof getActiveBusiness>>>;

type UpgradeSession = {
  user?: {
    email?: string | null;
    name?: string | null;
  } | null;
} | null;

export type UpgradeAuthorizationDeps = {
  getSession?: () => Promise<UpgradeSession>;
  getBusiness?: (options: { allowInactive: boolean }) => Promise<ActiveBusiness | null>;
  getValidatedImpersonatedBusinessId?: () => Promise<string | null>;
};

export type AuthorizedUpgradeContext = UpgradeAccessContext<ActiveBusiness>;

/**
 * Billing recovery is allowed for the actual owner or for a platform admin whose
 * signed impersonation context was validated again on this request.
 */
export async function getAuthorizedUpgradeContext(
  deps: UpgradeAuthorizationDeps = {},
): Promise<AuthorizedUpgradeContext | null> {
  const session = await (deps.getSession ?? (async () => auth()))();
  const email = session?.user?.email?.trim();
  if (!email) return null;

  const business = await (deps.getBusiness ?? ((options) => getActiveBusiness(options)))({
    allowInactive: true,
  });
  if (!business) return null;

  const impersonatedBusinessId = await (
    deps.getValidatedImpersonatedBusinessId ?? getImpersonatedBusinessId
  )();

  const mode = resolveUpgradeAccessMode({
    actorEmail: email,
    business,
    validatedImpersonatedBusinessId: impersonatedBusinessId,
  });
  if (!mode) return null;

  return {
    actor: { email, name: session?.user?.name?.trim() || null },
    business,
    mode,
  };
}
