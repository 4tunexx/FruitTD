/** Prefer a linked player's live Steam persona/avatar, then the saved account profile. */
export interface PvpAccountIdentity {
  steamId?: string | null;
  steamPersona?: string | null;
  steamAvatar?: string | null;
  username?: string | null;
  nickname?: string | null;
  avatar?: string | null;
}

export function pvpAccountIdentity(account: PvpAccountIdentity | null | undefined, fallbackName = 'Player') {
  const steamLinked = Boolean(account?.steamId);
  const name = (steamLinked ? account?.steamPersona : account?.username) || account?.nickname || fallbackName;
  const avatar = (steamLinked ? account?.steamAvatar : account?.avatar) || account?.avatar || '';
  return { name: String(name).trim().slice(0, 32) || 'Player', avatar: String(avatar).slice(0, 900_000) };
}
