import { requirementById } from '../../src/game/requirements';
import { Router, Request, Response } from 'express';
import type { Collection } from 'mongodb';
import { getCollection, MissionDoc, CloudSaveDoc } from '../db';
import { getMonthKey, loadQuestCatalog } from '../catalog';
import { resolveRequestUser } from '../auth';
import { validProgressUpdates } from '../validation';
import { creditClaimReward } from '../claimWallet';
import { missionState } from '../questState';
import { saveNotification, type NotificationRecord } from '../notifications';

type RequestUser = Awaited<ReturnType<typeof resolveRequestUser>>;

export interface MissionRouteDeps {
  resolveUser(req: Request): Promise<RequestUser>;
  collection<T extends Record<string, any>>(name: string): Promise<Collection<T>>;
  catalog(): ReturnType<typeof loadQuestCatalog>;
}

const defaultDeps: MissionRouteDeps = { resolveUser: resolveRequestUser, collection: getCollection, catalog: loadQuestCatalog };

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
  if (type === 'main') return 'MAIN';
  if (type === 'weekly') return getWeekKey();
  if (type === 'monthly') return `M-${getMonthKey()}`;
  return getDayKey();
}

export function createMissionsRouter(deps: MissionRouteDeps = defaultDeps): Router {
const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await deps.resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to view missions' });
    const userId = user.userId;

    const catalog = await deps.catalog();
    const defs = catalog.missions.filter((m) => m.enabled !== false);
    const col = await deps.collection<MissionDoc>('missions');
    const userDocs = await col.find({ userId }).toArray();
    const wallet = await (await deps.collection<CloudSaveDoc>('cloud_saves')).findOne({ userId });
    res.setHeader('Cache-Control', 'private, no-store');

    const missions = defs.map((def) => {
      const activeKey = periodKey(def.type);
      const state = missionState(def, userDocs, wallet?.claimReceipts || [], activeKey);
      const goal = def.requirement?.goal || 1;
      const progress = state.progress;
      return {
        id: def.id,
        type: def.type,
        title: def.title,
        desc: def.desc,
        icon: def.icon,
        goal,
        rewardCoins: def.rewardCoins,
        rewardSp: def.rewardSp,
        rewardGems: def.rewardGems ?? 0,
        rewardBadge: def.rewardBadge,
        periodKey: activeKey,
        progress,
        completed: state.completed,
        claimed: state.claimed,
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

router.post('/progress', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    if (!validProgressUpdates(updates, 'missionId')) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }
    const user = await deps.resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to update missions' });
    const userId = user.userId;

    const catalog = await deps.catalog();
    const col = await deps.collection<MissionDoc>('missions');
    const newlyCompleted: string[] = [];
    const wallet = await (await deps.collection<CloudSaveDoc>('cloud_saves')).findOne({ userId });

    for (const update of updates) {
      const def = catalog.missions.find((m) => m.id === update.missionId && m.enabled !== false);
      if (!def) continue;
      const authorityEvent = def.requirement && requirementById(def.requirement.type)?.event;
      if (authorityEvent === 'pvp_result' || authorityEvent === 'coop_result') continue;

      const activeKey = periodKey(def.type);
      const history = def.type === 'main'
        ? await col.find({ userId, missionId: def.id }).toArray()
        : [await col.findOne({ userId, missionId: def.id, dayKey: activeKey })].filter((doc): doc is NonNullable<typeof doc> => !!doc);
      const existing = missionState(def, history, wallet?.claimReceipts || [], activeKey);
      if (existing.completed) continue;
      let currentProgress = existing.progress;
      const goal = def.requirement?.goal || 1;

      if (typeof update.setProgress === 'number') {
        currentProgress = Math.max(currentProgress, update.setProgress);
      } else if (typeof update.progressDelta === 'number') {
        currentProgress += update.progressDelta;
      }

      if (currentProgress >= goal && !existing?.completed) newlyCompleted.push(def.id);

      await col.updateOne(
        { userId, missionId: def.id, dayKey: activeKey },
        {
          $max: { progress: Math.min(goal, currentProgress), completed: currentProgress >= goal },
          $set: { goal, updatedAt: new Date() },
          $setOnInsert: { claimed: false },
        },
        { upsert: true }
      );
    }

    for (const missionId of newlyCompleted) {
      const def = catalog.missions.find((mission) => mission.id === missionId);
      if (!def) continue;
      const reward = [
        def.rewardCoins ? `${def.rewardCoins} coins` : '',
        def.rewardGems ? `${def.rewardGems} gems` : '',
        def.rewardSp ? `${def.rewardSp} skill points` : '',
      ].filter(Boolean).join(' · ');
      await saveNotification(() => deps.collection<NotificationRecord>('notifications'), {
        userId, type: 'mission_ready', title: 'Mission completed',
        body: `${def.title}${reward ? ` · Claim ${reward}` : ' · Claim your reward'}`,
        eventKey: `mission-ready:${userId}:${periodKey(def.type)}:${missionId}`,
      });
    }

    res.json({ success: true, newlyCompleted });
  } catch (err: any) {
    console.error('Error updating missions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/claim', async (req: Request, res: Response) => {
  try {
    const { missionId } = req.body;
    const user = await deps.resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to claim missions' });
    const userId = user.userId;
    const catalog = await deps.catalog();
    const def = catalog.missions.find((m) => m.id === missionId && m.enabled !== false);
    if (!def) {
      return res.status(400).json({ success: false, error: 'Invalid missionId' });
    }

    const activeKey = periodKey(def.type);
    const col = await deps.collection<MissionDoc>('missions');
    const history = def.type === 'main'
      ? await col.find({ userId, missionId }).toArray()
      : [await col.findOne({ userId, missionId, dayKey: activeKey })].filter((doc): doc is NonNullable<typeof doc> => !!doc);
    const saves = await deps.collection<CloudSaveDoc>('cloud_saves');
    const currentWallet = await saves.findOne({ userId });
    const existing = missionState(def, history, currentWallet?.claimReceipts || [], activeKey);

    if (!existing.completed) {
      return res.status(400).json({ success: false, error: 'Mission is not completed yet' });
    }
    if (existing.claimed) {
      return res.status(400).json({ success: false, error: 'Mission reward already claimed' });
    }

    const wallet = await creditClaimReward(userId, `mission:${activeKey}:${missionId}`, {
      coins: def.rewardCoins,
      gems: def.rewardGems ?? 0,
      skillPoints: def.rewardSp,
    }, saves);
    if (!wallet) return res.status(400).json({ success: false, error: 'Mission reward already claimed' });

    await col.updateOne({ userId, missionId, dayKey: activeKey }, { $set: { claimed: true, completed: true, progress: def.requirement?.goal || 1, goal: def.requirement?.goal || 1, updatedAt: new Date() } }, { upsert: true }).catch(error => {
      console.error('Could not update mission claim marker; wallet receipt retained:', error);
    });

    const reward = [
      def.rewardCoins ? `${def.rewardCoins} coins` : '',
      def.rewardGems ? `${def.rewardGems} gems` : '',
      def.rewardSp ? `${def.rewardSp} skill points` : '',
    ].filter(Boolean).join(' · ');
    await saveNotification(() => deps.collection<NotificationRecord>('notifications'), {
      userId, type: 'mission_reward', title: 'Mission reward received',
      body: `${def.title}${reward ? ` · ${reward}` : ''}`,
      eventKey: `mission-reward:${userId}:${activeKey}:${missionId}`,
    });

    res.json({
      success: true,
      missionId,
      rewardCoins: def.rewardCoins,
      rewardSp: def.rewardSp,
      rewardGems: def.rewardGems ?? 0,
      rewardBadge: def.rewardBadge,
      saveData: wallet.saveData,
      revision: wallet.revision,
    });
  } catch (err: any) {
    console.error('Error claiming mission reward:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

return router;
}

export const missionsRouter = createMissionsRouter();
