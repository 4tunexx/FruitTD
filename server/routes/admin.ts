import { Router, Request, Response } from 'express';
import { getCollection, DailyBonusDoc, LeaderboardDoc } from '../db';
import { ObjectId } from 'mongodb';
import { invalidateCatalogCache } from '../catalog';
import {
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_BADGES,
  DEFAULT_MISSIONS,
  DEFAULT_RANK_TIERS,
  monthlyLeaderboardMode,
} from '../../src/game/requirements';
import { DEFAULT_SLICERS } from '../../src/game/slicers';
import { campaignWaves } from '../../src/game/campaign';
import { resolveRequestUser } from '../auth';
import { validId } from '../validation';

export const adminRouter = Router();

export const ADMIN_STEAM_ID = process.env.ADMIN_STEAM_ID || '';

export interface AdminConfigDoc {
  configKey: string; // 'game_config'
  dailyRewards: Array<{
    day: number;
    coins: number;
    skillPoints: number;
    gems?: number;
    skinUnlock?: string;
    label: string;
    iconType: 'coin' | 'gem' | 'chest' | 'blade';
  }>;
  vipTiers?: Array<{
    tier: 'bronze' | 'silver' | 'gold';
    title: string;
    price: number;
    coinBonus: number;
    xpBonus: number;
    dailyCoins: number;
    dailySp: number;
    exclusiveSkins: string[];
    description: string;
  }>;
  menuConfig: {
    eyebrow: string;
    title: string;
    subtitle: string;
    announcement: string;
    themeColor: string;
    backgroundImage?: string;
    logoImage?: string;
    faviconImage?: string;
  };
  gameplayConfig: {
    startMoney: number;
    startLives: number;
    scoreMultiplier: number;
    superChargeMultiplier: number;
  };
  missions?: any[];
  achievements?: any[];
  badges?: any[];
  ranks?: any[];
  slicers?: any[];
  enemies?: any[];
  waves?: any;
  campaignBosses?: any[];
  updatedAt: Date;
}

const ICON_TYPES = new Set(['coin', 'gem', 'chest', 'blade']);

export function campaignBossRosterError(value: unknown): string | null {
  if (!Array.isArray(value) || value.length > 100) return 'Invalid campaign boss roster. Provide up to 100 stages.';
  const invalid = value.some((boss: any, index: number) =>
    !boss || typeof boss !== 'object' ||
    typeof boss.name !== 'string' || boss.name.length > 80 ||
    typeof boss.title !== 'string' || boss.title.length > 100 ||
    typeof boss.description !== 'string' || boss.description.length > 500 ||
    !Number.isFinite(boss.difficulty) || boss.difficulty < 1 || boss.difficulty > 8 ||
    !Number.isInteger(boss.rewardCoins) || boss.rewardCoins < 0 || boss.rewardCoins > Math.floor((campaignWaves(index + 1) + 1) * 100 / 1.5) ||
    !Number.isInteger(boss.rewardGems) || boss.rewardGems < 0 || boss.rewardGems > Math.floor((campaignWaves(index + 1) + 1) / 5) ||
    (boss.revealImage !== undefined && (typeof boss.revealImage !== 'string' || boss.revealImage.length > 30_000 || !/^data:image\/webp;base64,/.test(boss.revealImage)))
  );
  return invalid ? 'Invalid campaign boss roster. Check field ranges and keep each optimized reveal image under 30 KB.' : null;
}

function normalizeDailyRewards(input: unknown): AdminConfigDoc['dailyRewards'] {
  const rows = Array.isArray(input) ? input : [];
  return DEFAULT_ADMIN_CONFIG.dailyRewards.map((fallback, i) => {
    const row = (rows[i] ?? {}) as Record<string, any>;
    const iconType = ICON_TYPES.has(row.iconType) ? row.iconType : fallback.iconType;
    const coins = Math.max(0, Number(row.coins ?? fallback.coins) || 0);
    const skillPoints = Math.max(0, Number(row.skillPoints ?? fallback.skillPoints) || 0);
    const gems = Math.max(0, Number(row.gems ?? fallback.gems ?? 0) || 0);
    const skinUnlock = typeof row.skinUnlock === 'string' && row.skinUnlock.trim()
      ? row.skinUnlock.trim()
      : fallback.skinUnlock;
    return {
      day: i + 1,
      coins,
      skillPoints,
      ...(gems ? { gems } : {}),
      ...(skinUnlock ? { skinUnlock } : {}),
      label: String(row.label || fallback.label),
      iconType,
    };
  });
}

function normalizePrizeCatalog<T extends { id: string; rewardCoins?: number; rewardGems?: number; rewardSp?: number }>(
  input: unknown,
  defaults: T[],
): T[] {
  const rows = Array.isArray(input) ? input as T[] : defaults;
  return rows.map((item) => ({
    ...item,
    rewardCoins: Math.max(0, Math.min(1_000_000, Math.floor(Number(item.rewardCoins) || 0))),
    rewardGems: Math.max(0, Math.min(1_000_000, Math.floor(Number(item.rewardGems) || 0))),
    ...('rewardSp' in item ? { rewardSp: Math.max(0, Math.min(10_000, Math.floor(Number(item.rewardSp) || 0))) } : {}),
  }));
}

export function normalizeMenuConfig(
  input: unknown,
  fallback: AdminConfigDoc['menuConfig'] = DEFAULT_ADMIN_CONFIG.menuConfig,
): AdminConfigDoc['menuConfig'] {
  const row = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const text = (value: unknown, previous: string, max: number) => typeof value === 'string' ? value.slice(0, max) : previous;
  const asset = (value: unknown, previous = '') => {
    if (value === undefined) return previous;
    if (typeof value !== 'string' || !value) return '';
    if (/^https:\/\/[^\s]+$/i.test(value) && value.length <= 2048) return value;
    if (/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 900_000) return value;
    return '';
  };
  const themeColor = typeof row.themeColor === 'string' && /^#[0-9a-f]{6}$/i.test(row.themeColor)
    ? row.themeColor : fallback.themeColor;
  return {
    eyebrow: text(row.eyebrow, fallback.eyebrow, 120),
    title: text(row.title, fallback.title, 160),
    subtitle: text(row.subtitle, fallback.subtitle, 500),
    announcement: text(row.announcement, fallback.announcement, 500),
    themeColor,
    backgroundImage: asset(row.backgroundImage, fallback.backgroundImage),
    logoImage: asset(row.logoImage, fallback.logoImage),
    faviconImage: asset(row.faviconImage, fallback.faviconImage),
  };
}

function normalizeGameplayConfig(input: unknown): AdminConfigDoc['gameplayConfig'] {
  const row = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const num = (value: unknown, fallback: number, min: number, max: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    startMoney: num(row.startMoney, DEFAULT_ADMIN_CONFIG.gameplayConfig.startMoney, 0, 100000),
    startLives: num(row.startLives, DEFAULT_ADMIN_CONFIG.gameplayConfig.startLives, 1, 100),
    scoreMultiplier: num(row.scoreMultiplier, DEFAULT_ADMIN_CONFIG.gameplayConfig.scoreMultiplier, 0.1, 10),
    superChargeMultiplier: num(
      row.superChargeMultiplier,
      DEFAULT_ADMIN_CONFIG.gameplayConfig.superChargeMultiplier,
      0.5,
      5
    ),
  };
}

export const DEFAULT_ADMIN_CONFIG: Omit<AdminConfigDoc, 'updatedAt'> = {
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
    eyebrow: 'FRUIT TD · LIVE ONLINE',
    title: 'Slice.\nHold the Wall.',
    subtitle: 'High-speed tower defense with fruit-slashing action.',
    announcement: 'Welcome Slicers! Daily bonus is live. Climb the Global Leaderboard!',
    themeColor: '#a3e635',
    backgroundImage: '',
    logoImage: '',
    faviconImage: '',
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
  waves: { version: 1, levels: {} },
};

// Check if request is authenticated as admin (Steam ID only)
async function isAuthorized(req: Request): Promise<boolean> {
  const user = await resolveRequestUser(req);
  return Boolean(ADMIN_STEAM_ID && user?.steamId === ADMIN_STEAM_ID);
}

// GET /api/admin/config (Public or admin)
adminRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    const col = await getCollection<AdminConfigDoc>('admin_config');
    let doc = await col.findOne({ configKey: 'game_config' });
    if (!doc) {
      const seed: AdminConfigDoc = {
        ...DEFAULT_ADMIN_CONFIG,
        updatedAt: new Date(),
      };
      await col.insertOne(seed as any);
      doc = seed as unknown as typeof doc;
    }
    const cfg = doc!;
    res.json({
      success: true,
      config: {
        ...DEFAULT_ADMIN_CONFIG,
        ...cfg,
        menuConfig: normalizeMenuConfig(cfg.menuConfig),
        vipTiers: Array.isArray(cfg.vipTiers) && cfg.vipTiers.length ? cfg.vipTiers : DEFAULT_ADMIN_CONFIG.vipTiers,
        missions: normalizePrizeCatalog(cfg.missions, DEFAULT_MISSIONS),
        achievements: normalizePrizeCatalog(cfg.achievements, DEFAULT_ACHIEVEMENTS),
        badges: normalizePrizeCatalog(cfg.badges, DEFAULT_BADGES),
        ranks: normalizePrizeCatalog(cfg.ranks, DEFAULT_RANK_TIERS),
        slicers: Array.isArray(cfg.slicers) && cfg.slicers.length ? cfg.slicers : DEFAULT_SLICERS,
        enemies: Array.isArray(cfg.enemies) && cfg.enemies.length ? cfg.enemies : [],
        waves: cfg.waves && typeof cfg.waves === 'object' ? cfg.waves : DEFAULT_ADMIN_CONFIG.waves,
        campaignBosses: Array.isArray((cfg as any).campaignBosses) ? (cfg as any).campaignBosses.slice(0, 100) : [],
      },
    });
  } catch (err: any) {
    console.error('Error getting admin config:', err);
    res.json({
      success: true,
      offline: true,
      config: { ...DEFAULT_ADMIN_CONFIG, updatedAt: new Date() },
    });
  }
});

// POST /api/admin/verify (Verify admin status - Steam ID only)
adminRouter.post('/verify', async (req: Request, res: Response) => {
  const valid = await isAuthorized(req);
  res.json({
    success: true,
    isAdmin: valid,
  });
});

// POST /api/admin/config (Save changes to MongoDB)
adminRouter.post('/config', async (req: Request, res: Response) => {
  if (!(await isAuthorized(req))) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
  }

  try {
    const { dailyRewards, vipTiers, menuConfig, gameplayConfig, missions, achievements, badges, ranks, slicers, enemies, waves, campaignBosses } = req.body;
    const bossRosterError = campaignBosses === undefined ? null : campaignBossRosterError(campaignBosses);
    if (bossRosterError) return res.status(400).json({ success: false, error: bossRosterError });
    const col = await getCollection<AdminConfigDoc>('admin_config');
    const existing = await col.findOne({ configKey: 'game_config' });

    const updated = {
      configKey: 'game_config',
      dailyRewards: dailyRewards ? normalizeDailyRewards(dailyRewards) : existing?.dailyRewards || DEFAULT_ADMIN_CONFIG.dailyRewards,
      vipTiers: vipTiers || existing?.vipTiers || DEFAULT_ADMIN_CONFIG.vipTiers,
      menuConfig: menuConfig
        ? normalizeMenuConfig(menuConfig, normalizeMenuConfig(existing?.menuConfig))
        : normalizeMenuConfig(existing?.menuConfig),
      gameplayConfig: gameplayConfig ? normalizeGameplayConfig(gameplayConfig) : existing?.gameplayConfig || DEFAULT_ADMIN_CONFIG.gameplayConfig,
      missions: normalizePrizeCatalog(Array.isArray(missions) ? missions : existing?.missions, DEFAULT_MISSIONS),
      achievements: normalizePrizeCatalog(Array.isArray(achievements) ? achievements : existing?.achievements, DEFAULT_ACHIEVEMENTS),
      badges: normalizePrizeCatalog(Array.isArray(badges) ? badges : existing?.badges, DEFAULT_BADGES),
      ranks: normalizePrizeCatalog(Array.isArray(ranks) ? ranks : existing?.ranks, DEFAULT_RANK_TIERS),
      slicers: Array.isArray(slicers) ? slicers : existing?.slicers || DEFAULT_SLICERS,
      enemies: Array.isArray(enemies) ? enemies : existing?.enemies || [],
      waves: waves && typeof waves === 'object' ? waves : (existing?.waves || DEFAULT_ADMIN_CONFIG.waves),
      campaignBosses: campaignBosses !== undefined ? campaignBosses : ((existing as any)?.campaignBosses || []),
      updatedAt: new Date(),
    };

    await col.updateOne({ configKey: 'game_config' }, { $set: updated }, { upsert: true });
    invalidateCatalogCache();

    res.json({
      success: true,
      message: 'Admin configuration saved successfully to MongoDB Atlas!',
      config: updated,
    });
  } catch (err: any) {
    console.error('Error saving admin config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/reset-daily (Reset user's daily streak for instant testing)
adminRouter.post('/reset-daily', async (req: Request, res: Response) => {
  if (!(await isAuthorized(req))) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
  }

  try {
    const { userId } = req.body;
    if (!validId(userId)) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const col = await getCollection<DailyBonusDoc>('daily_bonus');
    await col.deleteOne({ userId });

    res.json({
      success: true,
      message: `Daily streak reset for user ${userId}. You can now claim Day 1 immediately!`,
    });
  } catch (err: any) {
    console.error('Error resetting daily bonus:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/leaderboard (View all entries for moderation)
adminRouter.get('/leaderboard', async (req: Request, res: Response) => {
  if (!(await isAuthorized(req))) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
  }

  try {
    const col = await getCollection<LeaderboardDoc>('leaderboards');
    const entries = await col.find({}).sort({ createdAt: -1 }).limit(100).toArray();
    res.json({ success: true, entries });
  } catch (err: any) {
    console.error('Error fetching admin leaderboard:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/leaderboard/delete (Delete a score entry)
adminRouter.post('/leaderboard/delete', async (req: Request, res: Response) => {
  if (!(await isAuthorized(req))) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin privileges required.' });
  }

  try {
    const { id, wipeAll, mode } = req.body;
    const col = await getCollection<LeaderboardDoc>('leaderboards');

    if (wipeAll && mode) {
      const resolved = mode === 'monthly' ? monthlyLeaderboardMode() : mode;
      const result = await col.deleteMany({ mode: resolved });
      return res.json({ success: true, message: `Deleted ${result.deletedCount} scores in mode ${resolved}.` });
    }

    if (id) {
      await col.deleteOne({ _id: new ObjectId(id) });
      return res.json({ success: true, message: `Score entry ${id} deleted.` });
    }

    res.status(400).json({ success: false, error: 'Missing entry id or wipeAll parameters.' });
  } catch (err: any) {
    console.error('Error deleting leaderboard entry:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
