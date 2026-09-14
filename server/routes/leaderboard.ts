import { Router, Request, Response } from 'express';
import { getCollection, LeaderboardDoc } from '../db';
import { loadQuestCatalog } from '../catalog';
import { monthlyLeaderboardMode, rankFromScore } from '../../src/game/requirements';

export const leaderboardRouter = Router();

function resolveMode(mode: string): string {
  if (mode === 'monthly') return monthlyLeaderboardMode();
  return mode || 'ranked';
}

leaderboardRouter.get('/monthly-rank', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const catalog = await loadQuestCatalog();
    const seasonMode = monthlyLeaderboardMode();
    const col = await getCollection<LeaderboardDoc>('leaderboards');
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
leaderboardRouter.get('/', async (req: Request, res: Response) => {
  try {
    const mode = resolveMode((req.query.mode as string) || 'ranked');
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const userId = req.query.userId as string;

    const col = await getCollection<LeaderboardDoc>('leaderboards');

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
leaderboardRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      nickname,
      avatar,
      hero,
      mode,
      score,
      wave,
      fruitsSliced,
      maxCombo,
      steamId,
      steamPersona,
      steamAvatar,
    } = req.body;

    if (!userId || typeof score !== 'number' || score < 0) {
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

    const col = await getCollection<LeaderboardDoc>('leaderboards');
    const playMode = mode || 'casual';

    const upsertBest = async (modeKey: string) => {
      const existing = await col.findOne({ userId, mode: modeKey });
      if (!existing) {
        await col.insertOne({
          userId,
          nickname: nickname || 'Slicer',
          avatar: avatar || '',
          hero: hero || 'jiju',
          mode: modeKey,
          score,
          wave: wave || 1,
          fruitsSliced: fruitsSliced || 0,
          maxCombo: maxCombo || 0,
          steamId,
          steamPersona,
          steamAvatar,
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
              steamId: steamId || existing.steamId,
              steamPersona: steamPersona || existing.steamPersona,
              steamAvatar: steamAvatar || existing.steamAvatar,
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

    const catalog = playMode === 'ranked' ? await loadQuestCatalog() : null;
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
