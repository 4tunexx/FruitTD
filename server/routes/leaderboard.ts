import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import type { Collection } from 'mongodb';
import { getCollection, LeaderboardDoc, RunTokenDoc, type CloudSaveDoc } from '../db';
import { loadQuestCatalog } from '../catalog';
import { monthlyLeaderboardMode, rankFromScore } from '../../src/game/requirements';
import { hashToken, resolveRequestUser } from '../auth';
import { boundedInteger } from '../validation';
import { creditClaimReward } from '../claimWallet';

type RequestUser = Awaited<ReturnType<typeof resolveRequestUser>>;

export interface LeaderboardRouteDeps {
  resolveUser(req: Request): Promise<RequestUser>;
  collection<T extends Record<string, any>>(name: string): Promise<Collection<T>>;
  catalog(): ReturnType<typeof loadQuestCatalog>;
}

const defaultDeps: LeaderboardRouteDeps = {
  resolveUser: resolveRequestUser,
  collection: getCollection,
  catalog: loadQuestCatalog,
};

const RUN_TOKEN_TTL_MS = 15 * 60 * 1000;

function resolveMode(mode: string): string {
  if (mode === 'monthly') return monthlyLeaderboardMode();
  return mode || 'ranked';
}

export function createLeaderboardRouter(deps: LeaderboardRouteDeps = defaultDeps): Router {
const router = Router();

router.get('/boards', async (req: Request, res: Response) => {
  const category = String(req.query.category || 'ranked'), scope = String(req.query.scope || 'global');
  if (!['ranked','casual','horde','coop','campaign','coins','gems'].includes(category) || !['global','friends'].includes(scope)) return res.status(400).json({ error: 'Invalid leaderboard category.' });
  try {
    const user = await deps.resolveUser(req);
    const filter: Record<string, any> = {};
    if (scope === 'friends') {
      if (!user) return res.status(401).json({ error: 'Sign in to compare with friends.' });
      const friends = await (await deps.collection<any>('friends')).find({ userId: user.userId, state: 'accepted' }).toArray();
      filter.userId = { $in: [user.userId, ...friends.map(friend => friend.friendId)] };
    }
    const wallet = category === 'coins' || category === 'gems', ranked = category === 'ranked';
    const collection = ranked ? 'pvp_ratings' : wallet ? 'cloud_saves' : 'leaderboards';
    const field = ranked ? 'points' : wallet ? `saveData.${category}` : category === 'horde' ? 'wave' : 'score';
    if (ranked) { filter.season = new Date().toISOString().slice(0, 7); filter.matches = { $gt: 0 }; }
    else if (!wallet) filter.mode = category;
    const rows = await (await deps.collection<any>(collection)).find(filter).sort({ [field]: -1, ...(category === 'horde' ? { score: -1 } : {}), userId: 1 }).limit(50).toArray();
    const users = rows.length ? await (await deps.collection<any>('users')).find({ userId: { $in: rows.map(row => row.userId) } }).toArray() : [];
    const names = new Map(users.map(person => [person.userId, person.username || person.nickname || 'Slicer']));
    res.json({ metric: ranked ? 'FR points' : wallet ? category : category === 'horde' ? 'highest wave' : 'high score', entries: rows.map((row, index) => ({ rank: index + 1, name: names.get(row.userId) || row.nickname || 'Slicer', value: Number(ranked ? row.points : wallet ? row.saveData?.[category] || 0 : row[field]), detail: ranked ? `${row.wins || 0} wins · ${row.matches} matches` : wallet ? 'Current balance' : `Wave ${row.wave} · Best combo ×${row.maxCombo || 0}`, isYou: row.userId === user?.userId })) });
  } catch { res.status(503).json({ error: 'Leaderboards are temporarily unavailable. Try again.' }); }
});

router.post('/run', async (req: Request, res: Response) => {
  try {
    const mode = req.body?.mode ?? 'casual';
    if (!['casual', 'ranked', 'coop', 'arena', 'horde', 'campaign'].includes(mode)) return res.status(400).json({ success: false, error: 'Invalid mode' });
    const user = await deps.resolveUser(req);
    if (!user) return res.status(401).json({ success: false, error: 'Sign in to start a leaderboard run' });

    const runToken = crypto.randomBytes(32).toString('hex');
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + RUN_TOKEN_TTL_MS);
    const col = await deps.collection<RunTokenDoc>('run_tokens');
    await col.insertOne({ tokenHash: hashToken(runToken), userId: user.userId, mode, createdAt, expiresAt });
    res.status(201).json({ success: true, runToken, expiresAt });
  } catch (err: any) {
    console.error('Error issuing run token:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/monthly-rank', async (req: Request, res: Response) => {
  try {
    const userId = (await deps.resolveUser(req))?.userId;
    const catalog = await deps.catalog();
    const seasonMode = monthlyLeaderboardMode();
    const col = await deps.collection<LeaderboardDoc>('leaderboards');
    const entry = userId ? await col.findOne({ userId, mode: seasonMode }, { sort: { score: -1 } }) : null;
    const score = entry?.score || 0;
    const rank = rankFromScore(score, catalog.ranks);
    const sorted = [...catalog.ranks].sort((a, b) => a.minScore - b.minScore);
    const next = sorted.find((t) => t.minScore > rank.minScore) || null;
    const wallet = userId ? await (await deps.collection<CloudSaveDoc>('cloud_saves')).findOne({ userId }) : null;
    const rewardReceipt = `rank:${seasonMode}:${rank.id}`;
    res.json({
      success: true,
      season: seasonMode,
      score,
      rank,
      next,
      hasEntry: !!entry,
      claimed: (wallet?.claimReceipts || []).includes(rewardReceipt),
      claimedRankIds: (wallet?.claimReceipts || []).filter((receipt) => receipt.startsWith(`rank:${seasonMode}:`)).map((receipt) => receipt.slice(`rank:${seasonMode}:`.length)),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/monthly-rank/claim', async (req: Request, res: Response) => {
  try {
    const userId = (await deps.resolveUser(req))?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Sign in to claim rank rewards' });
    const catalog = await deps.catalog();
    const season = monthlyLeaderboardMode();
    const board = await deps.collection<LeaderboardDoc>('leaderboards');
    const entry = await board.findOne({ userId, mode: season }, { sort: { score: -1 } });
    if (!entry) return res.status(422).json({ success: false, error: 'Play a ranked match to earn a season rank' });
    const currentRank = rankFromScore(entry.score, catalog.ranks);
    const requestedRankId = req.body?.rankId;
    const rank = requestedRankId === undefined ? currentRank : catalog.ranks.find((tier) => tier.id === requestedRankId);
    if (!rank) return res.status(400).json({ success: false, error: 'Invalid rank reward tier' });
    if (entry.score < rank.minScore) return res.status(422).json({ success: false, error: 'That rank reward has not been earned yet' });
    const receiptKey = `rank:${season}:${rank.id}`;
    const saves = await deps.collection<CloudSaveDoc>('cloud_saves');
    const wallet = await creditClaimReward(userId, receiptKey, {
      coins: rank.rewardCoins ?? 0,
      gems: rank.rewardGems ?? 0,
    }, saves);
    if (!wallet) return res.status(409).json({ success: false, error: 'This rank reward has already been claimed' });
    res.json({ success: true, rankId: rank.id, rewardCoins: rank.rewardCoins ?? 0, rewardGems: rank.rewardGems ?? 0, saveData: wallet.saveData, revision: wallet.revision });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leaderboard?mode=ranked&limit=50&userId=xxx
router.get('/', async (req: Request, res: Response) => {
  try {
    if (req.query.mode !== undefined && (typeof req.query.mode !== 'string' || !/^(casual|ranked|coop|arena|horde|campaign|monthly|monthly-\d{4}-\d{2})$/.test(req.query.mode))) return res.status(400).json({ success: false, error: 'Invalid mode' });
    const mode = resolveMode((req.query.mode as string) || 'ranked');
    const limit = Math.max(1, Math.min(parseInt(String(req.query.limit)) || 50, 100));
    const userId = (await deps.resolveUser(req))?.userId;

    const col = await deps.collection<LeaderboardDoc>('leaderboards');

    // Retrieve top entries sorted by score desc, wave desc
    const order = mode === 'horde' ? { wave: -1 as const, score: -1 as const } : { score: -1 as const, wave: -1 as const };
    const topEntries = await col
      .find({ mode })
      .sort(order)
      .limit(limit)
      .toArray();

    // Attach rank numbers
    const leaderboard = topEntries.map((entry, idx) => ({
      rank: idx + 1,
      userId: entry.userId,
      nickname: entry.nickname,
      avatar: entry.avatar,
      hero: entry.hero,
      mode: entry.mode,
      score: entry.score,
      wave: entry.wave,
      fruitsSliced: entry.fruitsSliced,
      maxCombo: entry.maxCombo,
      steamId: entry.steamId,
      steamPersona: entry.steamPersona,
      steamAvatar: entry.steamAvatar,
      date: entry.createdAt,
    }));

    // Find user's best entry and rank if userId supplied
    let userRank = null;
    if (userId) {
    const userBest = await col.findOne({ userId, mode }, { sort: order });
      if (userBest) {
        const higherCount = await col.countDocuments({
          mode,
          $or: mode === 'horde'
            ? [{ wave: { $gt: userBest.wave } }, { wave: userBest.wave, score: { $gt: userBest.score } }]
            : [{ score: { $gt: userBest.score } }, { score: userBest.score, wave: { $gt: userBest.wave } }],
        });
        userRank = {
          rank: higherCount + 1,
          score: userBest.score,
          wave: userBest.wave,
          hero: userBest.hero,
        };
      }
    }

    res.json({
      success: true,
      mode,
      leaderboard,
      userRank,
      totalEntries: await col.countDocuments({ mode }),
    });
  } catch (err: any) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leaderboard - Submit a new game score
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      nickname,
      avatar,
      hero,
      mode,
      score,
      wave,
      fruitsSliced,
      maxCombo,
      runToken,
      rewards,
      completed,
    } = req.body;
    if (mode !== undefined && !['casual', 'ranked', 'coop', 'arena', 'horde', 'campaign'].includes(mode)) return res.status(400).json({ success: false, error: 'Invalid mode' });
    if (hero !== undefined && !['jiju', 'topfu', 'lagen', 'tripos', 'ki'].includes(hero)) return res.status(400).json({ success: false, error: 'Invalid hero' });
    if ((wave !== undefined && !boundedInteger(wave, 1000, 1)) || (fruitsSliced !== undefined && !boundedInteger(fruitsSliced, 100_000)) || (maxCombo !== undefined && !boundedInteger(maxCombo, 5000))) return res.status(400).json({ success: false, error: 'Invalid match counters' });
    if ((nickname !== undefined && (typeof nickname !== 'string' || nickname.length > 64)) || (avatar !== undefined && (typeof avatar !== 'string' || avatar.length > 900_000))) return res.status(400).json({ success: false, error: 'Invalid profile fields' });

    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ success: false, error: 'Invalid score submission payload' });
    }

    if (rewards !== undefined) {
      const keys = ['coins', 'heroXp', 'towerXp', 'skillPoints'];
      if (!rewards || typeof rewards !== 'object' || Array.isArray(rewards) || Object.keys(rewards).some((key) => ![...keys, 'gems'].includes(key)) ||
          keys.some((key) => !boundedInteger(rewards[key], key === 'coins' ? 100_000 : 10_000)) ||
          (rewards.gems !== undefined && !boundedInteger(rewards.gems, 100))) {
        return res.status(400).json({ success: false, error: 'Invalid run reward payload' });
      }
      const rewardCaps = {
        coins: Math.min(100_000, Math.ceil(score * 2 + (wave || 1) * 100)),
        heroXp: Math.min(10_000, Math.ceil(score / 5 + (wave || 1) * 100 + 100)),
        towerXp: Math.min(10_000, Math.ceil(score / 3 + (wave || 1) * 150 + 100)),
        skillPoints: Math.min(100, Math.ceil(score / 1000) + 5),
        // Boss bounties plus one rare gem per 100 kills; match receipts are
        // still token-bound and each reward is credited only once.
        gems: Math.min(100, Math.floor((wave || 0) / 5) + Math.floor((fruitsSliced || 0) / 100)),
      };
      if (keys.some((key) => rewards[key] > rewardCaps[key as keyof typeof rewardCaps]) || (rewards.gems ?? 0) > rewardCaps.gems) {
        return res.status(422).json({ success: false, error: 'Run rewards exceed the score and wave limits' });
      }
    }
    if (completed !== undefined && typeof completed !== 'boolean') return res.status(400).json({ success: false, error: 'Invalid run completion state' });

    // SERVER-SIDE VALIDATION: Reject absurd values
    const MAX_REASONABLE_SCORE = 10_000_000;
    const MAX_REASONABLE_WAVE = 1000;
    const MAX_REASONABLE_FRUITS = 100_000;
    const MAX_REASONABLE_COMBO = 5000;

    if (score > MAX_REASONABLE_SCORE) {
      return res.status(400).json({ success: false, error: 'Score exceeds reasonable maximum' });
    }
    if (wave && wave > MAX_REASONABLE_WAVE) {
      return res.status(400).json({ success: false, error: 'Wave exceeds reasonable maximum' });
    }
    if (fruitsSliced && fruitsSliced > MAX_REASONABLE_FRUITS) {
      return res.status(400).json({ success: false, error: 'Fruits sliced exceeds reasonable maximum' });
    }
    if (maxCombo && maxCombo > MAX_REASONABLE_COMBO) {
      return res.status(400).json({ success: false, error: 'Combo exceeds reasonable maximum' });
    }

    const user = await deps.resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Sign in to submit leaderboard scores' });
    }
    const userId = user.userId;

    if (typeof runToken !== 'string' || !/^[a-f0-9]{64}$/.test(runToken)) {
      return res.status(401).json({ success: false, error: 'A valid run token is required' });
    }
    const playMode = mode || 'casual';
    const rewardTokenKey = hashToken(runToken);
    const runs = await deps.collection<RunTokenDoc>('run_tokens');
    const consumed = await runs.findOneAndUpdate(
      {
        tokenHash: hashToken(runToken),
        userId,
        mode: playMode,
        expiresAt: { $gt: new Date() },
        consumedAt: { $exists: false },
      },
      { $set: { consumedAt: new Date() } },
      { returnDocument: 'before' }
    );
    if (!consumed) return res.status(401).json({ success: false, error: 'Run token is invalid, expired, or already used' });

    // A one-use token proves identity, not gameplay. Bound submitted counters
    // against its server timestamp so instant forged high scores cannot mint
    // the maximum wallet rewards or claim the top leaderboard slots.
    const elapsedSeconds = Math.max(0, (Date.now() - new Date(consumed.createdAt).getTime()) / 1000);
    if (!Number.isFinite(elapsedSeconds) ||
        score > 2500 + elapsedSeconds * 600 ||
        (wave || 1) > 10 + Math.floor(elapsedSeconds / 2) ||
        (fruitsSliced || 0) > 100 + Math.floor(elapsedSeconds * 12) ||
        (maxCombo || 0) > 100 + Math.floor(elapsedSeconds * 12)) {
      return res.status(422).json({ success: false, error: 'Run counters exceed the time available since match start' });
    }

    let settledWallet: { saveData: Record<string, any>; revision: number } | null = null;
    if (rewards) {
      const wallet = await creditClaimReward(userId, `run:${rewardTokenKey}`, {
        coins: rewards.coins,
        gems: rewards.gems ?? 0,
        skillPoints: rewards.skillPoints,
        xp: { [hero || 'jiju']: rewards.heroXp },
        towerXp: rewards.towerXp,
        games: completed === false ? 0 : 1,
        highScore: score,
        rankedScore: playMode === 'ranked' && completed !== false ? score : 0,
        bestWave: wave || 1,
        bestCombo: maxCombo || 0,
      }, await deps.collection<CloudSaveDoc>('cloud_saves'));
      if (!wallet) return res.status(500).json({ success: false, error: 'Could not settle run rewards' });
      settledWallet = { saveData: wallet.saveData, revision: wallet.revision ?? 0 };
    }

    const col = await deps.collection<LeaderboardDoc>('leaderboards');

    const upsertBest = async (modeKey: string) => {
      const existing = await col.findOne({ userId, mode: modeKey });
      if (!existing) {
        await col.insertOne({
          userId,
          nickname: nickname || user.nickname || 'Slicer',
          avatar: avatar || user.avatar || '',
          hero: hero || 'jiju',
          mode: modeKey,
          score,
          wave: wave || 1,
          fruitsSliced: fruitsSliced || 0,
          maxCombo: maxCombo || 0,
          steamId: user.steamId,
          steamPersona: user.steamPersona,
          steamAvatar: user.steamAvatar,
          createdAt: new Date(),
        });
        return true;
      }
      if ((modeKey === 'horde' && ((wave || 1) > existing.wave || ((wave || 1) === existing.wave && score > existing.score))) ||
          (modeKey !== 'horde' && (score > existing.score || (score === existing.score && (wave || 1) > existing.wave)))) {
        await col.updateOne(
          { _id: existing._id },
          {
            $set: {
              nickname: nickname || existing.nickname,
              avatar: avatar || existing.avatar,
              hero: hero || existing.hero,
              score,
              wave: wave || existing.wave,
              fruitsSliced: Math.max(fruitsSliced || 0, existing.fruitsSliced),
              maxCombo: Math.max(maxCombo || 0, existing.maxCombo),
              steamId: user.steamId || existing.steamId,
              steamPersona: user.steamPersona || existing.steamPersona,
              steamAvatar: user.steamAvatar || existing.steamAvatar,
              createdAt: new Date(),
            },
          }
        );
        return true;
      }
      return false;
    };

    const isNewHigh = completed !== false ? await upsertBest(playMode) : false;
    if (playMode === 'ranked' && completed !== false) {
      await upsertBest(monthlyLeaderboardMode());
    }

    const higherCount = await col.countDocuments(playMode === 'horde'
      ? { mode: playMode, $or: [{ wave: { $gt: wave || 1 } }, { wave: wave || 1, score: { $gt: score } }] }
      : { mode: playMode, score: { $gt: score } });

    const catalog = playMode === 'ranked' ? await deps.catalog() : null;
    const monthlyScore = playMode === 'ranked'
      ? (await col.findOne({ userId, mode: monthlyLeaderboardMode() }))?.score || score
      : score;

    res.json({
      success: true,
      isNewHigh,
      rank: higherCount + 1,
      score,
      monthlyRank: catalog ? rankFromScore(monthlyScore, catalog.ranks) : undefined,
      wallet: settledWallet,
    });
  } catch (err: any) {
    console.error('Error submitting score:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

return router;
}

export const leaderboardRouter = createLeaderboardRouter();
