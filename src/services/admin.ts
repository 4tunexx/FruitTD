import {
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_BADGES,
  DEFAULT_MISSIONS,
  DEFAULT_RANK_TIERS,
  type CatalogAchievement,
  type CatalogBadge,
  type CatalogMission,
  type RankTier,
} from '../game/requirements';
import { DEFAULT_SLICERS, type CatalogSlicer } from '../game/slicers';
import { getCachedSteamState } from './steam';

export const ADMIN_STEAM_ID = '76561198001993310';

export type RewardIconType = 'coin' | 'gem' | 'chest' | 'blade';

export interface VipTierRewards {
  tier: 'bronze' | 'silver' | 'gold';
  title: string;
  price: number;
  coinBonus: number;
  xpBonus: number;
  dailyCoins: number;
  dailySp: number;
  exclusiveSkins: string[];
  description: string;
}

export interface AdminDailyReward {
  day: number;
  coins: number;
  skillPoints: number;
  gems?: number;
  skinUnlock?: string;
  label: string;
  iconType: RewardIconType;
}

export interface AdminConfig {
  configKey: string;
  dailyRewards: AdminDailyReward[];
  vipTiers: VipTierRewards[];
  menuConfig: {
    eyebrow: string;
    title: string;
    subtitle: string;
    announcement: string;
    themeColor: string;
  };
  gameplayConfig: {
    startMoney: number;
    startLives: number;
    scoreMultiplier: number;
    superChargeMultiplier: number;
  };
  missions: CatalogMission[];
  achievements: CatalogAchievement[];
  badges: CatalogBadge[];
  ranks: RankTier[];
  slicers: CatalogSlicer[];
  enemies: any[];
}

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  configKey: 'game_config',
  dailyRewards: [
    { day: 1, coins: 50, skillPoints: 0, gems: 5, label: '50 Coins + 5 💎', iconType: 'coin' },
    { day: 2, coins: 100, skillPoints: 1, gems: 10, label: '100 Coins + 1 SP + 10 💎', iconType: 'gem' },
    { day: 3, coins: 150, skillPoints: 0, gems: 15, label: '150 Coins + 15 💎', iconType: 'coin' },
    { day: 4, coins: 200, skillPoints: 0, gems: 20, label: '200 Coins + 20 💎', iconType: 'coin' },
    { day: 5, coins: 300, skillPoints: 2, gems: 25, label: '300 Coins + 2 SP + 25 💎', iconType: 'gem' },
    { day: 6, coins: 450, skillPoints: 0, gems: 30, label: '450 Coins + 30 💎', iconType: 'chest' },
    { day: 7, coins: 1000, skillPoints: 2, gems: 50, skinUnlock: 'blade-gold', label: '1,000 Coins + Gold Blade + 50 💎!', iconType: 'blade' },
  ],
  vipTiers: [
    { tier: 'bronze', title: 'Bronze VIP', price: 500, coinBonus: 10, xpBonus: 5, dailyCoins: 25, dailySp: 0, exclusiveSkins: [], description: '+10% coins, +5% XP, 25 daily coins' },
    { tier: 'silver', title: 'Silver VIP', price: 1500, coinBonus: 25, xpBonus: 15, dailyCoins: 75, dailySp: 1, exclusiveSkins: ['blade-silver-vip'], description: '+25% coins, +15% XP, 75 daily coins + 1 SP' },
    { tier: 'gold', title: 'Gold VIP', price: 5000, coinBonus: 50, xpBonus: 30, dailyCoins: 200, dailySp: 2, exclusiveSkins: ['blade-gold-vip', 'wall-gold-vip'], description: '+50% coins, +30% XP, 200 daily coins + 2 SP, exclusive skins' },
  ],
  menuConfig: {
    eyebrow: 'FRUIT TD · LIVE ONLINE',
    title: 'Slice.\nHold the Wall.',
    subtitle: 'High-speed tower defense with fruit-slashing action.',
    announcement: 'Welcome Slicers! Daily bonus is live. Climb the Global Leaderboard!',
    themeColor: '#a3e635',
  },
  gameplayConfig: {
    startMoney: 140,
    startLives: 15,
    scoreMultiplier: 1.0,
    superChargeMultiplier: 1.0,
  },
  missions: DEFAULT_MISSIONS,
  achievements: DEFAULT_ACHIEVEMENTS,
  badges: DEFAULT_BADGES,
  ranks: DEFAULT_RANK_TIERS,
  slicers: DEFAULT_SLICERS,
  enemies: [],
};

export function mergeAdminConfig(raw: Partial<AdminConfig> | null | undefined): AdminConfig {
  const src = raw || {};
  return {
    ...DEFAULT_ADMIN_CONFIG,
    ...src,
    dailyRewards: Array.isArray(src.dailyRewards) && src.dailyRewards.length === 7 ? src.dailyRewards : DEFAULT_ADMIN_CONFIG.dailyRewards,
    vipTiers: Array.isArray(src.vipTiers) && src.vipTiers.length === 3 ? src.vipTiers : DEFAULT_ADMIN_CONFIG.vipTiers,
    menuConfig: { ...DEFAULT_ADMIN_CONFIG.menuConfig, ...(src.menuConfig || {}) },
    gameplayConfig: { ...DEFAULT_ADMIN_CONFIG.gameplayConfig, ...(src.gameplayConfig || {}) },
    missions: structuredClone(Array.isArray(src.missions) && src.missions.length ? src.missions : DEFAULT_ADMIN_CONFIG.missions),
    achievements: structuredClone(Array.isArray(src.achievements) && src.achievements.length ? src.achievements : DEFAULT_ADMIN_CONFIG.achievements),
    badges: structuredClone(Array.isArray(src.badges) && src.badges.length ? src.badges : DEFAULT_ADMIN_CONFIG.badges),
    ranks: structuredClone(Array.isArray(src.ranks) && src.ranks.length ? src.ranks : DEFAULT_ADMIN_CONFIG.ranks),
    slicers: structuredClone(Array.isArray(src.slicers) && src.slicers.length ? src.slicers : DEFAULT_ADMIN_CONFIG.slicers),
    enemies: structuredClone(Array.isArray(src.enemies) && src.enemies.length ? src.enemies : DEFAULT_ADMIN_CONFIG.enemies),
  };
}

export function isUserAdmin(): boolean {
  const steam = getCachedSteamState();
  return steam.linked && steam.steamId === ADMIN_STEAM_ID;
}

function getAdminHeaders(): Record<string, string> {
  const steam = getCachedSteamState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (steam.steamId) {
    headers['x-admin-steamid'] = steam.steamId;
  }
  return headers;
}

export async function fetchAdminConfig(): Promise<AdminConfig | null> {
  try {
    const res = await fetch('/api/admin/config');
    if (!res.ok) return null;
    const data = await res.json();
    return data?.config ? mergeAdminConfig(data.config) : null;
  } catch (err) {
    console.error('Error fetching admin config:', err);
    return null;
  }
}

export async function saveAdminConfig(config: Partial<AdminConfig>): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to save config' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminResetDailyStreak(userId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/reset-daily', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to reset streak' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function adminFetchLeaderboards(): Promise<any[]> {
  try {
    const res = await fetch('/api/admin/leaderboard', {
      headers: getAdminHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.entries || [];
  } catch {
    return [];
  }
}

export async function adminDeleteScore(id: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/leaderboard/delete', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

export async function adminWipeLeaderboardMode(
  mode: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/leaderboard/delete', {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ wipeAll: true, mode }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to wipe mode' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
