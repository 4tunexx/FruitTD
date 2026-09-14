import { Router, Request, Response } from 'express';
import { getCollection, BadgeDoc } from '../db';
import { loadQuestCatalog } from '../catalog';
import { resolveRequestUser } from '../auth';

export const badgesRouter = Router();

badgesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to view badges' });
    const userId = user.userId;

    const catalog = await loadQuestCatalog();
    const defs = catalog.badges.filter((b) => b.enabled !== false);
    const col = await getCollection<BadgeDoc>('badges');
    const docs = await col.find({ userId }).toArray();
    const map = new Map(docs.map((d) => [d.badgeId, d]));

    const badges = defs.map((def) => {
      const doc = map.get(def.id);
      const maxProgress = def.requirement?.goal || 1;
      const progress = Math.min(doc?.progress || 0, maxProgress);
      const unlocked = !!doc?.unlocked || progress >= maxProgress;
      return {
        id: def.id,
        title: def.title,
        desc: def.desc,
        icon: def.icon,
        rarity: def.rarity,
        progress,
        maxProgress,
        unlocked,
      };
    });

    res.json({
      success: true,
      badges,
      unlocked: badges.filter((b) => b.unlocked).length,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

badgesRouter.post('/progress', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }
    const user = await resolveRequestUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to update badges' });
    const userId = user.userId;

    const catalog = await loadQuestCatalog();
    const col = await getCollection<BadgeDoc>('badges');
    const newlyUnlocked: string[] = [];

    for (const update of updates) {
      const def = catalog.badges.find((b) => b.id === update.badgeId && b.enabled !== false);
      if (!def) continue;
      const existing = await col.findOne({ userId, badgeId: def.id });
      let currentProgress = existing?.progress || 0;
      const maxProgress = def.requirement?.goal || 1;

      if (typeof update.setProgress === 'number') {
        currentProgress = Math.max(currentProgress, update.setProgress);
      } else if (typeof update.progressDelta === 'number') {
        currentProgress += update.progressDelta;
      }

      const unlocked = currentProgress >= maxProgress;
      if (unlocked && !existing?.unlocked) newlyUnlocked.push(def.id);

      await col.updateOne(
        { userId, badgeId: def.id },
        {
          $set: {
            progress: currentProgress,
            maxProgress,
            unlocked,
            unlockedAt: unlocked && !existing?.unlocked ? new Date() : existing?.unlockedAt,
          },
        },
        { upsert: true }
      );
    }

    res.json({ success: true, newlyUnlocked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
