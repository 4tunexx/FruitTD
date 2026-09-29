import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import type { Collection } from 'mongodb';
import { getCollection, LeaderboardDoc, RunTokenDoc } from '../db';
import { loadQuestCatalog } from '../catalog';
import { monthlyLeaderboardMode, rankFromScore } from '../../src/game/requirements';
import { hashToken, resolveRequestUser } from '../auth';
import { boundedInteger } from '../validation';

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

router.post('/run', async (req: Request, res: Response) => {
  try {
    const mode = req.body?.mode ?? 'casual';
    if (!['casual', 'ranked', 'coop', 'arena'].includes(mode)) return res.status(400).json({ success: false, error: 'Invalid mode' });
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
    res.json({
      success: true,
      season: seasonMode,
      score,
      rank,
      next,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leaderboard?mode=ranked&limit=50&userId=xxx
router.get('/', async (req: Request, res: Response) => {
  try {
    if (req.query.mode !== undefined && (typeof req.query.mode !== 'string' || !/^(casual|ranked|coop|arena|monthly|monthly-\d{4}-\d{2})$/.test(req.query.mode))) return res.status(400).json({ success: false, error: 'Invalid mode' });
    const mode = resolveMode((req.query.mode as string) || 'ranked');
    const limit = Math.max(1, Math.min(parseInt(String(req.query.limit)) || 50, 100));
    const userId = (await deps.resolveUser(req))?.userId;

    const col = await deps.collection<LeaderboardDoc>('leaderboards');

    // Retrieve top entries sorted by score desc, wave desc
    const topEntries = await col
      .find({ mode })
      .sort({ score: -1, wave: -1 })
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
      const userBest = await col.findOne({ userId, mode }, { sort: { score: -1 } });
      if (userBest) {
        const higherCount = await col.countDocuments({
          mode,
          $or: [
            { score: { $gt: userBest.score } },
            { score: userBest.score, wave: { $gt: userBest.wave } },
          ],
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
    } = req.body;
    if (mode !== undefined && !['casual', 'ranked', 'coop', 'arena'].includes(mode)) return res.status(400).json({ success: false, error: 'Invalid mode' });
    if (hero !== undefined && !['jiju', 'topfu', 'lagen', 'tripos', 'ki'].includes(hero)) return res.status(400).json({ success: false, error: 'Invalid hero' });
    if ((wave !== undefined && !boundedInteger(wave, 1000, 1)) || (fruitsSliced !== undefined && !boundedInteger(fruitsSliced, 100_000)) || (maxCombo !== undefined && !boundedInteger(maxCombo, 5000))) return res.status(400).json({ success: false, error: 'Invalid match counters' });
    if ((nickname !== undefined && (typeof nickname !== 'string' || nickname.length > 64)) || (avatar !== undefined && (typeof avatar !== 'string' || avatar.length > 900_000))) return res.status(400).json({ success: false, error: 'Invalid profile fields' });

    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ success: false, error: 'Invalid score submission payload' });
    }

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
      if (score > existing.score || (score === existing.score && (wave || 1) > existing.wave)) {
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

    const isNewHigh = await upsertBest(playMode);
    if (playMode === 'ranked') {
      await upsertBest(monthlyLeaderboardMode());
    }

    const higherCount = await col.countDocuments({
      mode: playMode,
      score: { $gt: score },
    });

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
    });
  } catch (err: any) {
    console.error('Error submitting score:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

return router;
}

export const leaderboardRouter = createLeaderboardRouter();
