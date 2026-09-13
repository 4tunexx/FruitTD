import { Router, Request, Response } from 'express';
import { getCollection, AchievementDoc } from '../db';
import { loadQuestCatalog } from '../catalog';

export const achievementsRouter = Router();

achievementsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const catalog = await loadQuestCatalog();
    const defs = catalog.achievements.filter((a) => a.enabled !== false);
    const col = await getCollection<AchievementDoc>('achievements');
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

achievementsRouter.post('/progress', async (req: Request, res: Response) => {
  try {
    const { userId, updates } = req.body;
    if (!userId || !Array.isArray(updates)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const catalog = await loadQuestCatalog();
    const col = await getCollection<AchievementDoc>('achievements');
    const newlyUnlocked: string[] = [];

    for (const update of updates) {
      const def = catalog.achievements.find((a) => a.id === update.achievementId && a.enabled !== false);
      if (!def) continue;

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
            progress: currentProgress,
            maxProgress,
            unlocked,
            unlockedAt: unlocked && !wasUnlocked ? new Date() : existing?.unlockedAt,
            claimed: existing?.claimed ?? false,
          },
        },
        { upsert: true }
      );
    }

    res.json({ success: true, newlyUnlocked });
  } catch (err: any) {
    console.error('Error updating achievement progress:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

achievementsRouter.post('/claim', async (req: Request, res: Response) => {
  try {
    const { userId, achievementId } = req.body;
    const catalog = await loadQuestCatalog();
    const def = catalog.achievements.find((a) => a.id === achievementId && a.enabled !== false);
    if (!userId || !def) {
      return res.status(400).json({ success: false, error: 'Invalid userId or achievementId' });
    }

    const col = await getCollection<AchievementDoc>('achievements');
    const existing = await col.findOne({ userId, achievementId });

    if (!existing || !existing.unlocked) {
      return res.status(400).json({ success: false, error: 'Achievement is not yet unlocked' });
    }
    if (existing.claimed) {
      return res.status(400).json({ success: false, error: 'Reward already claimed' });
    }

    await col.updateOne({ _id: existing._id }, { $set: { claimed: true } });

    res.json({
      success: true,
      achievementId,
      rewardCoins: def.rewardCoins,
      rewardSp: def.rewardSp,
      rewardBadge: def.rewardBadge,
    });
  } catch (err: any) {
    console.error('Error claiming achievement reward:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
