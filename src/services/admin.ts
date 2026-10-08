import { normalizeCoopConfig, type CoopConfig } from '../game/onlineCoop';
import { normalizeCreatorMedia } from '../game/creatorMedia';
import type { MediaStudioStore } from '../ui/adminMediaStudio';
import {
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_BADGES,
  DEFAULT_MISSIONS,
  DEFAULT_RANK_TIERS,
  mergeRewardDefaults, migrateCoopCatalog,
  type CatalogAchievement,
  type CatalogBadge,
  type CatalogMission,
  type RankTier,
} from '../game/requirements';
import { DEFAULT_SLICERS, type CatalogSlicer } from '../game/slicers';
import { DEFAULT_CAMPAIGN_STORIES, type CampaignChapter } from '../game/campaignStory';
import { getAuthToken, getCachedAuthUser } from './auth';
import { DEFAULT_PVP_CONFIG, normalizePvpMaps, type PvpConfig } from '../game/pvp';

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
  coopCatalogVersion?: number;
  dailyRewards: AdminDailyReward[];
  vipTiers: VipTierRewards[];
  menuConfig: {
    eyebrow: string;
    title: string;
    subtitle: string;
    announcement: string;
    themeColor: string;
    /** Optional CSS background-image URL for menus (title + dashboard). */
    backgroundImage?: string;
    /** Optional landing / menu logo image URL. */
    logoImage?: string;
    /** Optional favicon / app icon URL (wired to #app-favicon). */
    faviconImage?: string;
  };
  landscapeConfig: {
    locationName: string; skyColor: string; outerGroundColor: string; groundColor: string; groundGlowColor: string; foliageColor: string;
    ambientLight: number; sunLight: number; foliageEnabled: boolean;
  };
  gameplayConfig: {
    startMoney: number;
    startLives: number;
    scoreMultiplier: number;
    superChargeMultiplier: number;
  };
  pvpConfig: PvpConfig;
  coopConfig?: CoopConfig;
  creatorMedia?: MediaStudioStore | null;
  missions: CatalogMission[];
  achievements: CatalogAchievement[];
  badges: CatalogBadge[];
  ranks: RankTier[];
  slicers: CatalogSlicer[];
  enemies: any[];
  /** Creator-published wave/level packs (fruittd-creator-waves-v1 shape). */
  waves?: any;
  /** Per-stage boss description and reveal art. Boss animation sprites use Media Studio. */
  campaignBosses?: Array<{ name: string; title: string; description: string; difficulty: number; rewardCoins: number; rewardGems: number; revealImage?: string }>;
  campaignStories?: CampaignChapter[];
}

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  configKey: 'game_config',
  dailyRewards: [
    { day: 1, coins: 50, skillPoints: 0, gems: 5, label: '50 Coins + 5 Gems', iconType: 'coin' },
    { day: 2, coins: 100, skillPoints: 1, gems: 10, label: '100 Coins + 1 SP + 10 Gems', iconType: 'gem' },
    { day: 3, coins: 150, skillPoints: 0, gems: 15, label: '150 Coins + 15 Gems', iconType: 'coin' },
    { day: 4, coins: 200, skillPoints: 0, gems: 20, label: '200 Coins + 20 Gems', iconType: 'coin' },
    { day: 5, coins: 300, skillPoints: 2, gems: 25, label: '300 Coins + 2 SP + 25 Gems', iconType: 'gem' },
    { day: 6, coins: 450, skillPoints: 0, gems: 30, label: '450 Coins + 30 Gems', iconType: 'chest' },
    { day: 7, coins: 1000, skillPoints: 2, gems: 50, skinUnlock: 'blade-gold', label: '1,000 Coins + Gold Blade + 50 Gems!', iconType: 'blade' },
  ],
  vipTiers: [
    { tier: 'bronze', title: 'Bronze VIP', price: 500, coinBonus: 10, xpBonus: 5, dailyCoins: 25, dailySp: 0, exclusiveSkins: [], description: '+10% coins, +5% XP, 25 daily coins' },
    { tier: 'silver', title: 'Silver VIP', price: 1500, coinBonus: 25, xpBonus: 15, dailyCoins: 75, dailySp: 1, exclusiveSkins: ['blade-silver-vip'], description: '+25% coins, +15% XP, 75 daily coins + 1 SP' },
    { tier: 'gold', title: 'Gold VIP', price: 5000, coinBonus: 50, xpBonus: 30, dailyCoins: 200, dailySp: 2, exclusiveSkins: ['blade-gold-vip', 'wall-gold-vip'], description: '+50% coins, +30% XP, 200 daily coins + 2 SP, exclusive skins' },
  ],
  menuConfig: {
    eyebrow: 'FRUIT TD · HOLD THE WALL',
    title: 'Slice.\nHold the Wall.',
    subtitle: 'Chem flooded the world with fruit. Then the fruit woke up. Build towers. Defend the wall.',
    announcement: 'WALL BRIEFING: Daily supply drop is live. Ranked ladder is hot. Guest assist ready in Co-op.',
    themeColor: '#ffca28',
    backgroundImage: '',
    logoImage: '',
    faviconImage: '',
  },
  landscapeConfig: {
    locationName: 'Fallen Orchard', skyColor: '#4a5f3e', outerGroundColor: '#5a8a42', groundColor: '#6fa052',
    groundGlowColor: '#2a3a1f', foliageColor: '#3d8b3a', ambientLight: 0.92, sunLight: 0.85, foliageEnabled: true,
  },
  gameplayConfig: {
    startMoney: 140,
    startLives: 15,
    scoreMultiplier: 1.0,
    superChargeMultiplier: 1.0,
  },
  pvpConfig: structuredClone(DEFAULT_PVP_CONFIG),
  missions: DEFAULT_MISSIONS,
  achievements: DEFAULT_ACHIEVEMENTS,
  badges: DEFAULT_BADGES,
  ranks: DEFAULT_RANK_TIERS,
  slicers: DEFAULT_SLICERS,
  enemies: [],
  waves: { version: 1, levels: {} },
  campaignBosses: [],
  campaignStories: structuredClone(DEFAULT_CAMPAIGN_STORIES) as CampaignChapter[],
};

export function mergeAdminConfig(raw: Partial<AdminConfig> | null | undefined): AdminConfig {
  const src = raw || {};
  return {
    ...DEFAULT_ADMIN_CONFIG,
    ...src,
    dailyRewards: Array.isArray(src.dailyRewards) && src.dailyRewards.length === 7 ? src.dailyRewards : DEFAULT_ADMIN_CONFIG.dailyRewards,
    vipTiers: Array.isArray(src.vipTiers) && src.vipTiers.length === 3 ? src.vipTiers : DEFAULT_ADMIN_CONFIG.vipTiers,
    menuConfig: { ...DEFAULT_ADMIN_CONFIG.menuConfig, ...(src.menuConfig || {}) },
    landscapeConfig: { ...DEFAULT_ADMIN_CONFIG.landscapeConfig, ...(src.landscapeConfig || {}) },
    gameplayConfig: { ...DEFAULT_ADMIN_CONFIG.gameplayConfig, ...(src.gameplayConfig || {}) },
    coopConfig: normalizeCoopConfig(src.coopConfig),
    pvpConfig: mergePvpConfig(src.pvpConfig),
    creatorMedia: normalizeCreatorMedia(src.creatorMedia),
    coopCatalogVersion: 1,
    // A present catalogue is authoritative: Admin must be able to remove an entry
    // without the defaults silently restoring it on the next load.
    missions: structuredClone(Array.isArray(src.missions) ? src.missions : DEFAULT_ADMIN_CONFIG.missions),
    achievements: structuredClone(migrateCoopCatalog(Array.isArray(src.achievements) ? src.achievements : DEFAULT_ADMIN_CONFIG.achievements, DEFAULT_ACHIEVEMENTS, src.coopCatalogVersion)),
    badges: structuredClone(migrateCoopCatalog(Array.isArray(src.badges) ? src.badges : DEFAULT_ADMIN_CONFIG.badges, DEFAULT_BADGES, src.coopCatalogVersion)),
    ranks: mergeRewardDefaults(structuredClone(Array.isArray(src.ranks) && src.ranks.length ? src.ranks : DEFAULT_ADMIN_CONFIG.ranks), DEFAULT_ADMIN_CONFIG.ranks),
    slicers: structuredClone(Array.isArray(src.slicers) && src.slicers.length ? src.slicers : DEFAULT_ADMIN_CONFIG.slicers),
    enemies: structuredClone(Array.isArray(src.enemies) && src.enemies.length ? src.enemies : DEFAULT_ADMIN_CONFIG.enemies),
    waves: src.waves && typeof src.waves === 'object'
      ? structuredClone(src.waves)
      : structuredClone(DEFAULT_ADMIN_CONFIG.waves),
    campaignBosses: Array.isArray(src.campaignBosses) ? structuredClone(src.campaignBosses.slice(0, 100)) : [],
    campaignStories: Array.isArray(src.campaignStories) && src.campaignStories.length === 20
      ? structuredClone(src.campaignStories) : structuredClone(DEFAULT_CAMPAIGN_STORIES) as CampaignChapter[],
  };
}

function mergePvpConfig(raw: unknown): PvpConfig {
  const value = raw && typeof raw === 'object' ? raw as Partial<PvpConfig> : {};
  const bounded = (n: unknown, fallback: number, min: number, max: number) => Number.isFinite(Number(n)) ? Math.max(min, Math.min(max, Number(n))) : fallback;
  const maps = normalizePvpMaps(value.maps);
  const towers = { ...DEFAULT_PVP_CONFIG.towers };
  for (const [id, fallback] of Object.entries(towers)) {
    const row = value.towers?.[id];
    if (row) towers[id] = { cost: bounded(row.cost, fallback.cost, 1, 10000), damage: bounded(row.damage, fallback.damage, 1, 10000), range: bounded(row.range, fallback.range, 1, 24), cooldownMs: bounded(row.cooldownMs, fallback.cooldownMs, 100, 60000) };
  }
  const attacks = { ...DEFAULT_PVP_CONFIG.attacks };
  for (const [id, fallback] of Object.entries(attacks)) {
    const row = value.attacks?.[id];
    if (row) attacks[id] = { cost: bounded(row.cost, fallback.cost, 1, 10000), health: bounded(row.health, fallback.health, 1, 10000), speed: bounded(row.speed, fallback.speed, 0.1, 10), wallDamage: bounded(row.wallDamage, fallback.wallDamage, 1, 10000), rewardFruts: bounded(row.rewardFruts, fallback.rewardFruts, 0, 10000), packSize: Math.floor(bounded(row.packSize, fallback.packSize || 1, 1, 8)) };
  }
  const tiers = Array.isArray(value.rating?.tiers) ? value.rating!.tiers.slice(0, 7) : DEFAULT_PVP_CONFIG.rating.tiers;
  return {
    version: 1,
    maps,
    map: maps[0]!,
    durationSeconds: bounded(value.durationSeconds, DEFAULT_PVP_CONFIG.durationSeconds, 60, 600),
    wallHealth: bounded(value.wallHealth, DEFAULT_PVP_CONFIG.wallHealth, 100, 100000),
    startingFruts: bounded(value.startingFruts, DEFAULT_PVP_CONFIG.startingFruts, 0, 100000),
    incomePerSecond: bounded(value.incomePerSecond, DEFAULT_PVP_CONFIG.incomePerSecond, 0, 1000),
    reconnectGraceSeconds: bounded(value.reconnectGraceSeconds, DEFAULT_PVP_CONFIG.reconnectGraceSeconds, 10, 300),
    mainTower: {
      damage: bounded(value.mainTower?.damage, DEFAULT_PVP_CONFIG.mainTower.damage, 0, 10000),
      range: bounded(value.mainTower?.range, DEFAULT_PVP_CONFIG.mainTower.range, 0, 24),
      cooldownMs: bounded(value.mainTower?.cooldownMs, DEFAULT_PVP_CONFIG.mainTower.cooldownMs, 100, 60000),
    },
    towers, attacks,
    rating: {
      ...DEFAULT_PVP_CONFIG.rating,
      ...(value.rating || {}),
      start: bounded(value.rating?.start, 1000, 0, 1_000_000),
      win: bounded(value.rating?.win, 50, 0, 1000), tie: bounded(value.rating?.tie, 20, 0, 1000),
      loss: -bounded(Math.abs(value.rating?.loss ?? -50), 50, 1, 1000),
      bonusCap: bounded(value.rating?.bonusCap, 20, 0, 1000),
      seasonResetPercent: bounded(value.rating?.seasonResetPercent, 25, 0, 100),
      combo: DEFAULT_PVP_CONFIG.rating.combo,
      tiers: tiers.map((tier, i) => ({ name: DEFAULT_PVP_CONFIG.rating.tiers[i]!.name, min: bounded(tier?.min, DEFAULT_PVP_CONFIG.rating.tiers[i]!.min, 0, 1_000_000) })),
    },
    seasonRewards: DEFAULT_PVP_CONFIG.seasonRewards.map((item, i) => ({ ...item, ...(value.seasonRewards?.[i] || {}), tier: item.tier })),
  };
}

export function isUserAdmin(): boolean {
  const user = getCachedAuthUser();
  return Boolean(user?.isAdmin && getAuthToken());
}

function getAdminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
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
