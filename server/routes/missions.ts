import { Router, Request, Response } from 'express';
import { getCollection, MissionDoc } from '../db';
import { getMonthKey, loadQuestCatalog } from '../catalog';

export const missionsRouter = Router();

function getDayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getWeekKey(): string {
  const d = new Date();
  const oneJan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum}`;
}

function periodKey(type: string): string {
  if (type === 'weekly') return getWeekKey();
  if (type === 'monthly') return `M-${getMonthKey()}`;
  return getDayKey();
}

missionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const catalog = await loadQuestCatalog();
    const defs = catalog.missions.filter((m) => m.enabled !== false);
    const keys = [...new Set(defs.map((d) => periodKey(d.type)))];
    const col = await getCollection<MissionDoc>('missions');
    const userDocs = await col.find({ userId, dayKey: { $in: keys } }).toArray();
    const docMap = new Map(userDocs.map((d) => [d.missionId, d]));

    const missions = defs.map((def) => {
      const activeKey = periodKey(def.type);
      const doc = docMap.get(def.id);
      const goal = def.requirement?.goal || 1;
      const progress = Math.min(doc?.progress || 0, goal);
      return {
        id: def.id,
        type: def.type,
        title: def.title,
        desc: def.desc,
        icon: def.icon,
        goal,
        rewardCoins: def.rewardCoins,
        rewardSp: def.rewardSp,
        rewardBadge: def.rewardBadge,
        periodKey: activeKey,
        progress,
        completed: progress >= goal,
        claimed: !!doc?.claimed,
      };
    });

    res.json({
      success: true,
      dayKey: getDayKey(),
      weekKey: getWeekKey(),
      monthKey: getMonthKey(),
      missions,
      totalClaimable: missions.filter((m) => m.completed && !m.claimed).length,
    });
  } catch (err: any) {
    console.error('Error fetching missions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

missionsRouter.post('/progress', async (req: Request, res: Response) => {
  try {
    const { userId, updates } = req.body;
    if (!userId || !Array.isArray(updates)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const catalog = await loadQuestCatalog();
    const col = await getCollection<MissionDoc>('missions');

    for (const update of updates) {
      const def = catalog.missions.find((m) => m.id === update.missionId && m.enabled !== false);
      if (!def) continue;

      const activeKey = periodKey(def.type);
      const existing = await col.findOne({ userId, missionId: def.id, dayKey: activeKey });
      let currentProgress = existing?.progress || 0;
      const goal = def.requirement?.goal || 1;

      if (typeof update.setProgress === 'number') {
        currentProgress = Math.max(currentProgress, update.setProgress);
      } else if (typeof update.progressDelta === 'number') {
        currentProgress += update.progressDelta;
      }

      await col.updateOne(
        { userId, missionId: def.id, dayKey: activeKey },
        {
          $set: {
            progress: currentProgress,
            goal,
            completed: currentProgress >= goal,
            claimed: existing?.claimed ?? false,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating missions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

missionsRouter.post('/claim', async (req: Request, res: Response) => {
  try {
    const { userId, missionId } = req.body;
    const catalog = await loadQuestCatalog();
    const def = catalog.missions.find((m) => m.id === missionId && m.enabled !== false);
    if (!userId || !def) {
      return res.status(400).json({ success: false, error: 'Invalid missionId' });
    }

    const activeKey = periodKey(def.type);
    const col = await getCollection<MissionDoc>('missions');
    const existing = await col.findOne({ userId, missionId, dayKey: activeKey });

    if (!existing || !existing.completed) {
      return res.status(400).json({ success: false, error: 'Mission is not completed yet' });
    }
    if (existing.claimed) {
      return res.status(400).json({ success: false, error: 'Mission reward already claimed' });
    }

    await col.updateOne({ _id: existing._id }, { $set: { claimed: true, updatedAt: new Date() } });

    res.json({
      success: true,
      missionId,
      rewardCoins: def.rewardCoins,
      rewardSp: def.rewardSp,
      rewardBadge: def.rewardBadge,
    });
  } catch (err: any) {
    console.error('Error claiming mission reward:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
