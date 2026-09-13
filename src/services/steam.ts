import { getSteamStatus } from './api';
import { loadSave, writeSave } from '../game/save';
import {
  fetchMe,
  getAuthToken,
  getCachedAuthUser,
  setAuthToken,
  setCachedAuthUser,
  setSessionAuthed,
  type AuthUser,
} from './auth';

export interface LocalSteamState {
  linked: boolean;
  steamId?: string;
  personaName?: string;
  avatar?: string;
}

let cachedSteam: LocalSteamState = { linked: false };

export { isSessionAuthed, setSessionAuthed } from './auth';

export function getCachedSteamState(): LocalSteamState {
  const user = getCachedAuthUser();
  if (user?.steamId) {
    return {
      linked: true,
      steamId: user.steamId,
      personaName: user.steamPersona || user.nickname,
      avatar: user.steamAvatar || user.avatar,
    };
  }
  return cachedSteam;
}

function syncSaveFromUser(user: AuthUser): void {
  const save = loadSave();
  if (user.nickname) save.nickname = user.nickname;
  if (user.avatar) save.avatar = user.avatar;
  writeSave(save);
}

export async function syncSteamState(): Promise<LocalSteamState> {
  const user = (await fetchMe()) || getCachedAuthUser();
  if (user) {
    setCachedAuthUser(user);
    if (user.steamId) {
      cachedSteam = {
        linked: true,
        steamId: user.steamId,
        personaName: user.steamPersona || user.nickname,
        avatar: user.steamAvatar || user.avatar,
      };
      syncSaveFromUser(user);
      return cachedSteam;
    }
  }

  if (!getAuthToken()) {
    cachedSteam = { linked: false };
    return cachedSteam;
  }

  const status = await getSteamStatus();
  if (status && status.linked) {
    cachedSteam = {
      linked: true,
      steamId: status.steamId,
      personaName: status.personaName,
      avatar: status.avatar,
    };
    const save = loadSave();
    if (status.personaName) save.nickname = status.personaName;
    if (status.avatar) save.avatar = status.avatar;
    writeSave(save);
  } else {
    cachedSteam = { linked: false };
  }
  return cachedSteam;
}

/** Legacy helper — OpenID is preferred. */
export async function linkSteamAccount(
  _query: string
): Promise<{ success: boolean; profile?: never; error?: string }> {
  return {
    success: false,
    error: 'Use Sign in through Steam — the Steam login popup opens the official Steam page.',
  };
}

export function applySteamBonusIfNeeded(bonus: boolean): void {
  if (!bonus) return;
  const save = loadSave();
  save.coins += 500;
  save.skillPoints += 1;
  writeSave(save);
}

export function consumeAuthCallbackParams(): {
  token?: string;
  needsEmail?: boolean;
  bonus?: boolean;
  error?: string;
  steam?: boolean;
} {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('auth_token') || undefined;
  const error = params.get('auth_error') || undefined;
  const needsEmail = params.get('needs_email') === '1';
  const bonus = params.get('bonus') === '1';
  const steam = params.get('steam') === '1';

  if (token || error || steam) {
    params.delete('auth_token');
    params.delete('auth_error');
    params.delete('needs_email');
    params.delete('bonus');
    params.delete('steam');
    params.delete('mode');
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', clean);
  }

  if (token) {
    setAuthToken(token);
    setSessionAuthed(false); // gate until email/profile complete
  }

  return { token, needsEmail, bonus, error, steam };
}
