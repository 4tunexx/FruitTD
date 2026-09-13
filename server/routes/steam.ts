import { Router, Request, Response } from 'express';
import { getCollection, UserDoc, AchievementDoc } from '../db';
import { resolveSteamId, fetchSteamPlayerSummary } from '../steam';

export const steamRouter = Router();

// POST /api/steam/link
// Body: { userId, steamQuery }
steamRouter.post('/link', async (req: Request, res: Response) => {
  try {
    const { userId, steamQuery } = req.body;
    if (!userId || !steamQuery) {
      return res.status(400).json({ success: false, error: 'userId and steamQuery are required' });
    }

    const steamId = await resolveSteamId(steamQuery);
    if (!steamId) {
      return res.status(400).json({
        success: false,
        error: 'Could not resolve Steam ID. Please provide a valid SteamID64, profile link, or custom URL vanity name.',
      });
    }

    const summary = await fetchSteamPlayerSummary(steamId);
    if (!summary) {
      return res.status(404).json({ success: false, error: 'Steam profile not found via Steam Web API.' });
    }

    // Save to users collection
    const usersCol = await getCollection<UserDoc>('users');
    await usersCol.updateOne(
      { userId },
      {
        $set: {
          steamId: summary.steamId,
          steamPersona: summary.personaName,
          steamAvatar: summary.avatarFull,
          nickname: summary.personaName,
          avatar: summary.avatarMedium,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Auto-unlock steam_connect achievement
    try {
      const achCol = await getCollection<AchievementDoc>('achievements');
      await achCol.updateOne(
        { userId, achievementId: 'steam_connect' },
        {
          $set: {
            progress: 1,
            maxProgress: 1,
            unlocked: true,
            unlockedAt: new Date(),
            claimed: false,
          },
        },
        { upsert: true }
      );
    } catch {
      // non-fatal
    }

    res.json({
      success: true,
      profile: summary,
      bonusReward: { coins: 500, sp: 1 },
    });
  } catch (err: any) {
    console.error('Error linking Steam profile:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/steam/status?userId=xxx
steamRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const usersCol = await getCollection<UserDoc>('users');
    const user = await usersCol.findOne({ userId });

    if (!user || !user.steamId) {
      return res.json({ success: true, linked: false });
    }

    res.json({
      success: true,
      linked: true,
      steamId: user.steamId,
      personaName: user.steamPersona,
      avatar: user.steamAvatar,
    });
  } catch (err: any) {
    console.error('Error getting Steam status:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
