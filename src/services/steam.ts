import { linkSteam, getSteamStatus, type SteamProfile } from './api';
import { loadSave, writeSave } from '../game/save';

export interface LocalSteamState {
  linked: boolean;
  steamId?: string;
  personaName?: string;
  avatar?: string;
}

let cachedSteam: LocalSteamState = { linked: false };

export function getCachedSteamState(): LocalSteamState {
  return cachedSteam;
}

export async function syncSteamState(): Promise<LocalSteamState> {
  const status = await getSteamStatus();
  if (status && status.linked) {
    cachedSteam = {
      linked: true,
      steamId: status.steamId,
      personaName: status.personaName,
      avatar: status.avatar,
    };
    // Sync to local save
    const save = loadSave();
    if (status.personaName && save.nickname !== status.personaName) {
      save.nickname = status.personaName;
    }
    if (status.avatar && save.avatar !== status.avatar) {
      save.avatar = status.avatar;
    }
    writeSave(save);
  }
  return cachedSteam;
}

export async function linkSteamAccount(
  query: string
): Promise<{ success: boolean; profile?: SteamProfile; error?: string }> {
  try {
    const res = await linkSteam(query);
    if (!res) {
      return { success: false, error: 'Could not connect to Steam service' };
    }

    cachedSteam = {
      linked: true,
      steamId: res.profile.steamId,
      personaName: res.profile.personaName,
      avatar: res.profile.avatarFull,
    };

    // Reward player coins and SP
    const save = loadSave();
    save.coins += res.bonusReward.coins;
    save.skillPoints += res.bonusReward.sp;
    save.nickname = res.profile.personaName;
    save.avatar = res.profile.avatarFull;
    writeSave(save);

    return { success: true, profile: res.profile };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
