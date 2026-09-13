import { Router, Request, Response } from 'express';
import { getCollection, CloudSaveDoc, UserDoc } from '../db';

export const profileRouter = Router();

// GET /api/profile?userId=xxx
profileRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const col = await getCollection<CloudSaveDoc>('cloud_saves');
    const doc = await col.findOne({ userId });

    const usersCol = await getCollection<UserDoc>('users');
    const userDoc = await usersCol.findOne({ userId });

    res.json({
      success: true,
      saveData: doc?.saveData || null,
      updatedAt: doc?.updatedAt || null,
      user: userDoc
        ? {
            nickname: userDoc.nickname,
            avatar: userDoc.avatar,
            steamId: userDoc.steamId,
            steamPersona: userDoc.steamPersona,
            steamAvatar: userDoc.steamAvatar,
          }
        : null,
    });
  } catch (err: any) {
    console.error('Error fetching profile cloud save:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/profile/sync
// Body: { userId, saveData }
profileRouter.post('/sync', async (req: Request, res: Response) => {
  try {
    const { userId, saveData } = req.body;
    if (!userId || !saveData) {
      return res.status(400).json({ success: false, error: 'userId and saveData are required' });
    }

    const col = await getCollection<CloudSaveDoc>('cloud_saves');
    await col.updateOne(
      { userId },
      {
        $set: {
          saveData,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Also update user profile record
    const usersCol = await getCollection<UserDoc>('users');
    await usersCol.updateOne(
      { userId },
      {
        $set: {
          nickname: saveData.nickname || 'Slicer',
          avatar: saveData.avatar || '',
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ success: true, timestamp: new Date() });
  } catch (err: any) {
    console.error('Error syncing cloud save:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
