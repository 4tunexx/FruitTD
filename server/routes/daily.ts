import { Router, Request, Response } from 'express';
import { getCollection, DailyBonusDoc } from '../db';
import { AdminConfigDoc, DEFAULT_ADMIN_CONFIG } from './admin';
import { resolveRequestUser } from '../auth';

export const dailyRouter = Router();

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

function getDayKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// GET /api/daily?userId=xxx
dailyRouter.get('/', async (req: Request, res: Response) => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to view daily rewards' });
    const userId = user.userId;

    const todayStr = getDayKey();
    const col = await getCollection<DailyBonusDoc>('daily_bonus');
    const existing = await col.findOne({ userId });
    const activeRewards = await getActiveDailyRewards();

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
dailyRouter.post('/claim', async (req: Request, res: Response) => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to claim daily rewards' });
    const userId = user.userId;

    const todayStr = getDayKey();
    const col = await getCollection<DailyBonusDoc>('daily_bonus');
    const existing = await col.findOne({ userId });
    const activeRewards = await getActiveDailyRewards();

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

    await col.updateOne(
      { userId },
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

    res.json({
      success: true,
      streak: newStreak,
      reward,
    });
  } catch (err: any) {
    console.error('Error claiming daily bonus:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
