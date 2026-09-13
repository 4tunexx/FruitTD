import express from 'express';
import cors from 'cors';
import { leaderboardRouter } from './routes/leaderboard';
import { achievementsRouter } from './routes/achievements';
import { missionsRouter } from './routes/missions';
import { dailyRouter } from './routes/daily';
import { steamRouter } from './routes/steam';
import { profileRouter } from './routes/profile';
import { adminRouter } from './routes/admin';
import { badgesRouter } from './routes/badges';
import { authRouter } from './routes/auth';
import { getDb } from './db';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use((req, _res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  app.get('/api/health', async (_req, res) => {
    try {
      const db = await getDb();
      const ping = await db.command({ ping: 1 });
      res.json({ status: 'ok', mongo: ping.ok === 1, time: new Date() });
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api/achievements', achievementsRouter);
  app.use('/api/missions', missionsRouter);
  app.use('/api/daily', dailyRouter);
  app.use('/api/steam', steamRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/badges', badgesRouter);

  return app;
}
