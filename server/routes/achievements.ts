import { requirementById } from '../../src/game/requirements';
import { Router, Request, Response } from 'express';
import type { Collection } from 'mongodb';
import { getCollection, AchievementDoc, CloudSaveDoc } from '../db';
import { loadQuestCatalog } from '../catalog';
import { resolveRequestUser } from '../auth';
import { validProgressUpdates } from '../validation';
import { creditClaimReward } from '../claimWallet';
import { saveNotification, type NotificationRecord } from '../notifications';

type RequestUser = Awaited<ReturnType<typeof resolveRequestUser>>;

export interface AchievementRouteDeps {
  resolveUser(req: Request): Promise<RequestUser>;
  collection<T extends Record<string, any>>(name: string): Promise<Collection<T>>;
  catalog(): ReturnType<typeof loadQuestCatalog>;
}

const defaultDeps: AchievementRouteDeps = { resolveUser: resolveRequestUser, collection: getCollection, catalog: loadQuestCatalog };

export function createAchievementsRouter(deps: AchievementRouteDeps = defaultDeps): Router {
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await deps.resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to view achievements' });
    const userId = user.userId;

    const catalog = await deps.catalog();
    const defs = catalog.achievements.filter((a) => a.enabled !== false);
    const col = await deps.collection<AchievementDoc>('achievements');
    const userDocs = await col.find({ userId }).toArray();
    const docMap = new Map(userDocs.map((d) => [d.achievementId, d]));

    const list = defs.map((def) => {
      const doc = docMap.get(def.id);
      const maxProgress = def.requirement?.goal || 1;
      const progress = Math.min(doc?.progress || 0, maxProgress);
      const unlocked = !!doc?.unlocked || progress >= maxProgress;
      return {
        id: def.id,
        title: def.title,
        desc: def.desc,
        icon: def.icon,
        maxProgress,
        rewardCoins: def.rewardCoins,
        rewardSp: def.rewardSp,
        rewardGems: def.rewardGems ?? 0,
        rewardBadge: def.rewardBadge,
        progress,
        unlocked,
        claimed: !!doc?.claimed,
        unlockedAt: doc?.unlockedAt,
      };
    });

    res.json({
      success: true,
      achievements: list,
      stats: {
        total: defs.length,
        unlocked: list.filter((a) => a.unlocked).length,
        claimable: list.filter((a) => a.unlocked && !a.claimed).length,
      },
    });
  } catch (err: any) {
    console.error('Error fetching achievements:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/progress', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    if (!validProgressUpdates(updates, 'achievementId')) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }
    const user = await deps.resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to update achievements' });
    const userId = user.userId;

    const catalog = await deps.catalog();
    const col = await deps.collection<AchievementDoc>('achievements');
    const newlyUnlocked: string[] = [];

    for (const update of updates) {
      const def = catalog.achievements.find((a) => a.id === update.achievementId && a.enabled !== false);
      if (!def) continue;
      const authorityEvent = def.requirement && requirementById(def.requirement.type)?.event;
      if (authorityEvent === 'pvp_result' || authorityEvent === 'coop_result') continue;

      const existing = await col.findOne({ userId, achievementId: def.id });
      let currentProgress = existing?.progress || 0;
      const maxProgress = def.requirement?.goal || 1;

      if (typeof update.setProgress === 'number') {
        currentProgress = Math.max(currentProgress, update.setProgress);
      } else if (typeof update.progressDelta === 'number') {
        currentProgress += update.progressDelta;
      }

      const unlocked = currentProgress >= maxProgress;
      const wasUnlocked = existing?.unlocked ?? false;
      if (unlocked && !wasUnlocked) newlyUnlocked.push(def.id);

      await col.updateOne(
        { userId, achievementId: def.id },
        {
          $set: {
            progress: Math.min(maxProgress, currentProgress),
            maxProgress,
            unlocked,
            unlockedAt: unlocked && !wasUnlocked ? new Date() : existing?.unlockedAt,
          },
          $setOnInsert: { claimed: false },
        },
        { upsert: true }
      );
    }

    for (const achievementId of newlyUnlocked) {
      const def = catalog.achievements.find((achievement) => achievement.id === achievementId);
      if (!def) continue;
      const reward = [
        def.rewardCoins ? `${def.rewardCoins} coins` : '',
        def.rewardGems ? `${def.rewardGems} gems` : '',
        def.rewardSp ? `${def.rewardSp} skill points` : '',
      ].filter(Boolean).join(' · ');
      await saveNotification(() => deps.collection<NotificationRecord>('notifications'), {
        userId, type: 'achievement_unlocked', title: 'Achievement unlocked',
        body: `${def.title}${reward ? ` · Claim ${reward}` : ''}`,
        eventKey: `achievement-unlocked:${userId}:${achievementId}`,
      });
    }

    res.json({ success: true, newlyUnlocked });
  } catch (err: any) {
    console.error('Error updating achievement progress:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/claim', async (req: Request, res: Response) => {
  try {
    const { achievementId } = req.body;
    const user = await deps.resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to claim achievements' });
    const userId = user.userId;
    const catalog = await deps.catalog();
    const def = catalog.achievements.find((a) => a.id === achievementId && a.enabled !== false);
    if (!def) {
      return res.status(400).json({ success: false, error: 'Invalid achievementId' });
    }

    const col = await deps.collection<AchievementDoc>('achievements');
    const existing = await col.findOne({ userId, achievementId });

    if (!existing || !existing.unlocked) {
      return res.status(400).json({ success: false, error: 'Achievement is not yet unlocked' });
    }
    if (existing.claimed) {
      return res.status(400).json({ success: false, error: 'Reward already claimed' });
    }

    const saves = await deps.collection<CloudSaveDoc>('cloud_saves');
    const wallet = await creditClaimReward(userId, `achievement:${achievementId}`, {
      coins: def.rewardCoins,
      gems: def.rewardGems ?? 0,
      skillPoints: def.rewardSp,
    }, saves);
    if (!wallet) return res.status(400).json({ success: false, error: 'Reward already claimed' });

    const claim = await col.updateOne({ _id: existing._id, claimed: { $ne: true }, unlocked: true }, { $set: { claimed: true } });
    if (claim.modifiedCount !== 1) return res.status(400).json({ success: false, error: 'Reward already claimed' });

    const reward = [
      def.rewardCoins ? `${def.rewardCoins} coins` : '',
      def.rewardGems ? `${def.rewardGems} gems` : '',
      def.rewardSp ? `${def.rewardSp} skill points` : '',
    ].filter(Boolean).join(' · ');
    await saveNotification(() => deps.collection<NotificationRecord>('notifications'), {
      userId, type: 'achievement_reward', title: 'Achievement reward received',
      body: `${def.title}${reward ? ` · ${reward}` : ''}`,
      eventKey: `achievement-reward:${userId}:${achievementId}`,
    });

    res.json({
      success: true,
      achievementId,
      rewardCoins: def.rewardCoins,
      rewardSp: def.rewardSp,
      rewardGems: def.rewardGems ?? 0,
      rewardBadge: def.rewardBadge,
      saveData: wallet.saveData,
      revision: wallet.revision,
    });
  } catch (err: any) {
    console.error('Error claiming achievement reward:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

return router;
}

export const achievementsRouter = createAchievementsRouter();
