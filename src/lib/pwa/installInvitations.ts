export const MAX_INSTALL_INVITATIONS = 3;
export const INSTALL_INVITATION_COOLDOWN = 24 * 60 * 60 * 1000;
export type InstallInvitationState = { shown: number; lastShownAt: number; disabled: boolean };

export function readInstallInvitation(raw: string | null): InstallInvitationState | null {
  if (raw === null) return { shown: 0, lastShownAt: 0, disabled: false };
  if (raw.length > 1000) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.shown !== 'number' || !Number.isInteger(record.shown) ||
    record.shown < 0 || record.shown > MAX_INSTALL_INVITATIONS ||
    typeof record.lastShownAt !== 'number' || !Number.isFinite(record.lastShownAt) || record.lastShownAt < 0 ||
    typeof record.disabled !== 'boolean') return null;
  return { shown: record.shown, lastShownAt: record.lastShownAt, disabled: record.disabled };
}

export function canInviteInstall(state: InstallInvitationState, now: number): boolean {
  return !state.disabled && state.shown < MAX_INSTALL_INVITATIONS &&
    (state.shown === 0 || now - state.lastShownAt >= INSTALL_INVITATION_COOLDOWN);
}
