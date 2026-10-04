import { requirementById } from '../../src/game/requirements';
import { Router, Request, Response } from 'express';
import { getCollection, BadgeDoc, type CloudSaveDoc } from '../db';
import { loadQuestCatalog } from '../catalog';
import { resolveRequestUser } from '../auth';
import { validProgressUpdates } from '../validation';
import { creditClaimReward } from '../claimWallet';

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
    const wallet = await (await getCollection<CloudSaveDoc>('cloud_saves')).findOne({ userId });
    const receipts = new Set(wallet?.claimReceipts || []);
    const rewardedBadgeIds = new Set<string>();
    for (const mission of catalog.missions) {
      if (mission.rewardBadge && [...receipts].some((receipt) => receipt.startsWith('mission:') && receipt.endsWith(`:${mission.id}`))) {
        rewardedBadgeIds.add(mission.rewardBadge);
      }
    }
    for (const achievement of catalog.achievements) {
      if (achievement.rewardBadge && receipts.has(`achievement:${achievement.id}`)) rewardedBadgeIds.add(achievement.rewardBadge);
    }
    const map = new Map(docs.map((d) => [d.badgeId, d]));

    const badges = defs.map((def) => {
      const doc = map.get(def.id);
      const maxProgress = def.requirement?.goal || 1;
      const progress = Math.min(doc?.progress || 0, maxProgress);
      const unlocked = !!doc?.unlocked || progress >= maxProgress || rewardedBadgeIds.has(def.id);
      return {
        id: def.id,
        title: def.title,
        desc: def.desc,
        icon: def.icon,
        rarity: def.rarity,
        rewardCoins: def.rewardCoins ?? 0,
        rewardGems: def.rewardGems ?? 0,
        claimed: receipts.has(`badge:${def.id}`),
        progress: rewardedBadgeIds.has(def.id) ? maxProgress : progress,
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

badgesRouter.post('/claim', async (req: Request, res: Response) => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to claim badge rewards' });
    const badgeId = req.body?.badgeId;
    if (typeof badgeId !== 'string') return res.status(400).json({ success: false, error: 'Invalid badge id' });
    const catalog = await loadQuestCatalog();
    const def = catalog.badges.find((badge) => badge.id === badgeId && badge.enabled !== false);
    if (!def) return res.status(404).json({ success: false, error: 'Badge not found' });
    const badges = await getCollection<BadgeDoc>('badges');
    const badge = await badges.findOne({ userId: user.userId, badgeId });
    const walletCol = await getCollection<CloudSaveDoc>('cloud_saves');
    const currentWallet = await walletCol.findOne({ userId: user.userId });
    const receipts = currentWallet?.claimReceipts || [];
    const missionReceiptUnlock = catalog.missions.some((mission) => mission.rewardBadge === badgeId && receipts.some((receipt) => receipt.startsWith('mission:') && receipt.endsWith(`:${mission.id}`)));
    const achievementReceiptUnlock = catalog.achievements.some((achievement) => achievement.rewardBadge === badgeId && receipts.includes(`achievement:${achievement.id}`));
    if (!badge?.unlocked && (badge?.progress ?? 0) < (def.requirement?.goal ?? 1) && !missionReceiptUnlock && !achievementReceiptUnlock) {
      return res.status(422).json({ success: false, error: 'Badge has not been unlocked' });
    }
    const wallet = await creditClaimReward(user.userId, `badge:${badgeId}`, {
      coins: def.rewardCoins ?? 0,
      gems: def.rewardGems ?? 0,
    });
    if (!wallet) return res.status(409).json({ success: false, error: 'Badge reward already claimed' });
    res.json({ success: true, badgeId, rewardCoins: def.rewardCoins ?? 0, rewardGems: def.rewardGems ?? 0, saveData: wallet.saveData, revision: wallet.revision });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

badgesRouter.post('/progress', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    if (!validProgressUpdates(updates, 'badgeId')) {
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
      const authorityEvent = def.requirement && requirementById(def.requirement.type)?.event;
      if (authorityEvent === 'pvp_result' || authorityEvent === 'coop_result') continue;
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
            progress: Math.min(maxProgress, currentProgress),
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
