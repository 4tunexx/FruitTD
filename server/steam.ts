import dotenv from 'dotenv';

dotenv.config();

const STEAM_API_KEY = process.env.STEAM_API_KEY || '';

export interface SteamPlayerSummary {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatar: string;
  avatarMedium: string;
  avatarFull: string;
  countryCode?: string;
  realName?: string;
}

/**
 * Extracts SteamID64 or vanity name from a Steam profile URL, vanity query, or raw ID.
 * Supports:
 * - 76561198000000000
 * - https://steamcommunity.com/profiles/76561198000000000/
 * - https://steamcommunity.com/id/vanityname/
 * - vanityname
 */
export async function resolveSteamId(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Check if raw 17-digit SteamID64
  if (/^\d{17}$/.test(trimmed)) {
    return trimmed;
  }

  // Check URL with /profiles/7656119...
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) {
    return profileMatch[1];
  }

  // Check URL with /id/vanity
  let vanity = trimmed;
  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_-]+)/i);
  if (idMatch) {
    vanity = idMatch[1];
  }

  if (!STEAM_API_KEY) {
    console.warn('STEAM_API_KEY is not set');
    return null;
  }

  // Resolve vanity URL via Steam API
  try {
    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(vanity)}`;
    const res = await fetch(url);
    const data = (await res.json()) as any;
    if (data?.response?.success === 1 && data?.response?.steamid) {
      return data.response.steamid;
    }
  } catch (err) {
    console.error('Error resolving Steam vanity URL:', err);
  }

  return null;
}

export async function fetchSteamPlayerSummary(steamId: string): Promise<SteamPlayerSummary | null> {
  if (!STEAM_API_KEY) {
    console.warn('STEAM_API_KEY is not set');
    return null;
  }
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`;
    const res = await fetch(url);
    const data = (await res.json()) as any;
    const player = data?.response?.players?.[0];
    if (!player) return null;

    return {
      steamId: player.steamid,
      personaName: player.personaname,
      profileUrl: player.profileurl,
      avatar: player.avatar,
      avatarMedium: player.avatarmedium,
      avatarFull: player.avatarfull,
      countryCode: player.loccountrycode,
      realName: player.realname,
    };
  } catch (err) {
    console.error('Error fetching Steam player summary:', err);
    return null;
  }
}
