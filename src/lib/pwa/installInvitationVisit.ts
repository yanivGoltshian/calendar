import { canInviteInstall, type InstallInvitationState } from './installInvitations';

export const INSTALL_INVITATION_DELAY = 8000;
export const INSTALL_INVITATION_RETRY_DELAY = 2000;

type InvitationContext = {
  now: number;
  handledThisVisit: boolean;
  installed: boolean;
  visible: boolean;
  interacting: boolean;
};

type InvitationDecision =
  | { action: 'stop' | 'wait' }
  | { action: 'show'; state: InstallInvitationState };

/**
 * A visit is one loaded document, including client navigation and remounts.
 * Busy or hidden pages defer without consuming the persisted display budget.
 */
export function nextInstallInvitation(
  state: InstallInvitationState | null,
  context: InvitationContext,
): InvitationDecision {
  if (
    !state ||
    !Number.isFinite(context.now) ||
    context.now < 0 ||
    context.handledThisVisit ||
    context.installed ||
    !canInviteInstall(state, context.now)
  ) {
    return { action: 'stop' };
  }
  if (!context.visible || context.interacting) return { action: 'wait' };
  return {
    action: 'show',
    state: { ...state, shown: state.shown + 1, lastShownAt: context.now },
  };
}

export function installInvitationKey(
  variant: string,
  pathname: string,
  manifestUrl?: string,
  invitationSlug?: string,
): string | null {
  if (variant !== 'business' && variant !== 'admin') return null;
  try {
    const slug = variant === 'business'
      ? decodeURIComponent(pathname.match(/^\/b\/([^/]+)/)?.[1] ?? '')
      : invitationSlug?.trim() ||
        (manifestUrl ? new URL(manifestUrl).searchParams.get('slug') : null);
    return slug ? `torchick:install-invite:v1:${variant}:${slug}` : null;
  } catch {
    return null;
  }
}
