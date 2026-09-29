import { Router, Request, Response } from 'express';
import type { Collection } from 'mongodb';
import { getCollection, DailyBonusDoc, CloudSaveDoc } from '../db';
import { AdminConfigDoc, DEFAULT_ADMIN_CONFIG } from './admin';
import { resolveRequestUser } from '../auth';
import { creditClaimReward } from '../claimWallet';
import { loadQuestCatalog } from '../catalog';
import { WALL_SKINS } from '../../src/game/save';

type RequestUser = Awaited<ReturnType<typeof resolveRequestUser>>;

export interface DailyRouteDeps {
  resolveUser(req: Request): Promise<RequestUser>;
  collection<T extends Record<string, any>>(name: string): Promise<Collection<T>>;
  rewards(): Promise<DailyRewardTier[]>;
  allowedSkinIds(): Promise<ReadonlySet<string>>;
  vipTiers?(): Promise<NonNullable<AdminConfigDoc['vipTiers']>>;
}

const defaultDeps: DailyRouteDeps = {
  resolveUser: resolveRequestUser,
  collection: getCollection,
  rewards: getActiveDailyRewards,
  vipTiers: async () => {
    const col = await getCollection<AdminConfigDoc>('admin_config');
    const doc = await col.findOne({ configKey: 'game_config' });
    return doc?.vipTiers?.length ? doc.vipTiers : DEFAULT_ADMIN_CONFIG.vipTiers || [];
  },
  allowedSkinIds: async () => {
    const catalog = await loadQuestCatalog();
    return new Set([...catalog.slicers.map((item) => item.id), ...WALL_SKINS.map((item) => item.id)]);
  },
};

export interface DailyRewardTier {
  day: number;
  coins: number;
  skillPoints: number;
  gems?: number; // P1-2
  skinUnlock?: string;
  label: string;
  iconType?: 'coin' | 'gem' | 'chest' | 'blade';
}

export async function getActiveDailyRewards(): Promise<DailyRewardTier[]> {
  try {
    const col = await getCollection<AdminConfigDoc>('admin_config');
    const doc = await col.findOne({ configKey: 'game_config' });
    if (doc?.dailyRewards && Array.isArray(doc.dailyRewards) && doc.dailyRewards.length > 0) {
      return DEFAULT_ADMIN_CONFIG.dailyRewards.map((fallback, i) => ({
        ...fallback,
        ...(doc.dailyRewards[i] || {}),
        day: i + 1,
      }));
    }
  } catch {
    // fallback
  }
  return DEFAULT_ADMIN_CONFIG.dailyRewards;
}

async function withVipDailyBonus(userId: string, rewards: DailyRewardTier[], deps: DailyRouteDeps): Promise<DailyRewardTier[]> {
  if (!deps.vipTiers) return rewards;
  const saves = await deps.collection<CloudSaveDoc>('cloud_saves');
  const wallet = await saves.findOne({ userId });
  const status = wallet?.saveData?.vipStatus;
  const vip = (await deps.vipTiers()).find((tier) => tier.tier === status);
  if (!vip) return rewards;
  const coinBonus = Math.max(0, Math.min(1_000_000, Math.floor(Number(vip.dailyCoins) || 0)));
  const skillBonus = Math.max(0, Math.min(10_000, Math.floor(Number(vip.dailySp) || 0)));
  return rewards.map((reward) => ({
    ...reward,
    coins: Math.min(1_000_000, reward.coins + coinBonus),
    skillPoints: Math.min(10_000, reward.skillPoints + skillBonus),
    label: `${reward.label} · VIP +${coinBonus} Coins${skillBonus ? ` +${skillBonus} SP` : ''}`,
  }));
}

function getDayKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// GET /api/daily?userId=xxx
export function createDailyRouter(deps: DailyRouteDeps = defaultDeps): Router {
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await deps.resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to view daily rewards' });
    const userId = user.userId;

    const todayStr = getDayKey();
    const col = await deps.collection<DailyBonusDoc>('daily_bonus');
    const existing = await col.findOne({ userId });
    const activeRewards = await withVipDailyBonus(userId, await deps.rewards(), deps);

    let currentStreak = existing?.streak || 0;
    let canClaim = false;

    if (!existing || !existing.lastClaimDate) {
      // First time user: can claim Day 1
      canClaim = true;
      currentStreak = 1;
    } else {
      const lastDate = new Date(existing.lastClaimDate);
      const todayDate = new Date(todayStr);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Already claimed today
        canClaim = false;
      } else if (diffDays === 1) {
        // Consecutive day: can claim next day in streak
        canClaim = true;
        currentStreak = (existing.streak % 7) + 1;
      } else {
        // Streak broken (> 1 day missed): reset to Day 1
        canClaim = true;
        currentStreak = 1;
      }
    }

    res.json({
      success: true,
      streak: currentStreak,
      canClaim,
      lastClaimDate: existing?.lastClaimDate || null,
      today: todayStr,
      rewards: activeRewards,
    });
  } catch (err: any) {
    console.error('Error getting daily bonus status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/daily/claim
// Body: { userId }
router.post('/claim', async (req: Request, res: Response) => {
  try {
    const user = await deps.resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to claim daily rewards' });
    const userId = user.userId;

    const todayStr = getDayKey();
    const col = await deps.collection<DailyBonusDoc>('daily_bonus');
    const existing = await col.findOne({ userId });
    const activeRewards = await withVipDailyBonus(userId, await deps.rewards(), deps);

    let newStreak = 1;
    if (existing && existing.lastClaimDate) {
      const lastDate = new Date(existing.lastClaimDate);
      const todayDate = new Date(todayStr);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return res.status(400).json({ success: false, error: 'Daily bonus already claimed for today' });
      } else if (diffDays === 1) {
        newStreak = (existing.streak % 7) + 1;
      } else {
        newStreak = 1;
      }
    }

    const reward = activeRewards[newStreak - 1] || activeRewards[0];
    if (reward.skinUnlock && !(await deps.allowedSkinIds()).has(reward.skinUnlock)) {
      return res.status(500).json({ success: false, error: 'Configured daily reward item is unavailable' });
    }

    const saves = await deps.collection<CloudSaveDoc>('cloud_saves');
    const wallet = await creditClaimReward(userId, `daily:${todayStr}`, {
      coins: reward.coins,
      gems: reward.gems,
      skillPoints: reward.skillPoints,
      items: reward.skinUnlock ? [reward.skinUnlock] : [],
    }, saves);
    if (!wallet) return res.status(400).json({ success: false, error: 'Daily bonus already claimed for today' });

    const consumed = await col.updateOne(
      { userId, lastClaimDate: { $ne: todayStr } },
      {
        $set: {
          streak: newStreak,
          lastClaimDate: todayStr,
          updatedAt: new Date(),
        },
        $inc: {
          totalClaimed: 1,
        },
      },
      { upsert: true }
    );
    if (consumed.modifiedCount !== 1 && consumed.upsertedCount !== 1) {
      return res.status(409).json({ success: false, error: 'Daily claim receipt was recorded; reload your wallet' });
    }

    res.json({
      success: true,
      streak: newStreak,
      reward,
      saveData: wallet.saveData,
      revision: wallet.revision,
    });
  } catch (err: any) {
    if (err?.code === 11000) return res.status(400).json({ success: false, error: 'Daily bonus already claimed for today' });
    console.error('Error claiming daily bonus:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

return router;
}

export const dailyRouter = createDailyRouter();
