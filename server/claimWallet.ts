import type { Collection } from 'mongodb';
import { defaultSave } from '../src/game/save';
import { getCollection, type CloudSaveDoc } from './db';
import { HEROES, heroXpToLevel } from '../src/game/heroes';
import { heroesUnlockedByJijuLevel } from '../src/game/progression/heroMilestones';

export interface ClaimReward {
  coins?: number;
  gems?: number;
  skillPoints?: number;
  xp?: Partial<Record<'jiju' | 'topfu' | 'lagen' | 'tripos' | 'ki', number>>;
  items?: string[];
  towerXp?: number;
  games?: number;
  highScore?: number;
  rankedScore?: number;
  bestWave?: number;
  bestCombo?: number;
}

/**
 * The wallet and its claim receipt live on one Mongo document. This single
 * conditional findOneAndUpdate is the atomic claim boundary, even on clusters
 * where multi-document transactions are unavailable.
 */
export async function creditClaimReward(
  userId: string,
  receiptKey: string,
  reward: ClaimReward,
  saves?: Collection<CloudSaveDoc>,
): Promise<CloudSaveDoc | null> {
  const col = saves ?? await getCollection<CloudSaveDoc>('cloud_saves');
  let existing = await col.findOne({ userId });
  if (!existing) {
    try {
      await col.insertOne({
        userId,
        saveData: defaultSave(),
        revision: 0,
        claimReceipts: [],
        updatedAt: new Date(),
      });
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
    existing = await col.findOne({ userId });
  }
  if (!existing) throw new Error('Could not initialize authoritative wallet');

  const now = new Date();
  const set: Record<string, unknown> = {
    revision: { $add: [{ $ifNull: ['$revision', 0] }, 1] },
    updatedAt: now,
    claimReceipts: { $setUnion: [{ $ifNull: ['$claimReceipts', []] }, [receiptKey]] },
  };
  const cappedCredit = (field: string, amount: number, cap: number) => ({
    $min: [cap, { $add: [{ $ifNull: [`$saveData.${field}`, 0] }, amount] }],
  });
  if ((reward.coins ?? 0) > 0) set['saveData.coins'] = cappedCredit('coins', reward.coins!, 1_000_000);
  if ((reward.gems ?? 0) > 0) set['saveData.gems'] = cappedCredit('gems', reward.gems!, 1_000_000);
  if ((reward.skillPoints ?? 0) > 0) set['saveData.skillPoints'] = cappedCredit('skillPoints', reward.skillPoints!, 10_000);
  for (const [hero, amount] of Object.entries(reward.xp ?? {})) {
    if (HEROES.some((entry) => entry.id === hero) && amount > 0) set[`saveData.xp.${hero}`] = cappedCredit(`xp.${hero}`, amount, 1_000_000);
  }
  if ((reward.towerXp ?? 0) > 0) {
    set['saveData.towerXp'] = cappedCredit('towerXp', reward.towerXp!, 1_000_000_000);
    set['saveData.towerLifetimeXp'] = cappedCredit('towerLifetimeXp', reward.towerXp!, 1_000_000_000);
  }
  if ((reward.games ?? 0) > 0) set['saveData.games'] = cappedCredit('games', reward.games!, 1_000_000);
  if ((reward.highScore ?? 0) > 0) set['saveData.highScore'] = { $max: [{ $ifNull: ['$saveData.highScore', 0] }, reward.highScore!] };
  if ((reward.rankedScore ?? 0) > 0) set['saveData.rankedScore'] = { $max: [{ $ifNull: ['$saveData.rankedScore', 0] }, reward.rankedScore!] };
  if ((reward.bestWave ?? 0) > 0) set['saveData.bestWave'] = { $max: [{ $ifNull: ['$saveData.bestWave', 1] }, reward.bestWave!] };
  if ((reward.bestCombo ?? 0) > 0) set['saveData.bestCombo'] = { $max: [{ $ifNull: ['$saveData.bestCombo', 0] }, reward.bestCombo!] };
  if (reward.xp?.jiju !== undefined) {
    const resultingJijuXp = Math.min(1_000_000, (Number(existing.saveData?.xp?.jiju) || 0) + reward.xp.jiju);
    const unlocked = heroesUnlockedByJijuLevel(heroXpToLevel(resultingJijuXp));
    if (unlocked.length) set['saveData.ownedHeroes'] = { $setUnion: [{ $ifNull: ['$saveData.ownedHeroes', ['jiju']] }, unlocked] };
  }
  if (reward.items?.length) {
    set['saveData.ownedSkins'] = { $setUnion: [{ $ifNull: ['$saveData.ownedSkins', []] }, reward.items] };
  }

  return col.findOneAndUpdate(
    {
      userId,
      claimReceipts: { $ne: receiptKey },
    },
    [{ $set: set }],
    { returnDocument: 'after' },
  );
}
