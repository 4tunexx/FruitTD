import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { createLeaderboardRouter } from './routes/leaderboard';

test('Horde standings reward the deepest wave before score', async (t) => {
  const rows = [
    { userId: 'fast', nickname: 'Fast', hero: 'jiju', avatar: '', mode: 'horde', score: 9000, wave: 8, fruitsSliced: 80, maxCombo: 5 },
    { userId: 'deep', nickname: 'Deep', hero: 'jiju', avatar: '', mode: 'horde', score: 7000, wave: 12, fruitsSliced: 95, maxCombo: 6 },
  ];
  const board: any = {
    find: () => {
      let sorted = [...rows];
      const cursor = {
        sort: (order: Record<string, number>) => {
          sorted.sort((a, b) => Object.entries(order).reduce((diff, [key, direction]) => diff || ((a as any)[key] - (b as any)[key]) * direction, 0));
          return cursor;
        },
        limit: () => cursor,
        toArray: async () => sorted,
      };
      return cursor;
    },
    countDocuments: async () => rows.length,
  };
  const router = createLeaderboardRouter({ resolveUser: async () => null, collection: async () => board, catalog: async () => ({ ranks: [] } as any) });
  const app = express(); app.use('/api/leaderboard', router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/leaderboard?mode=horde`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.leaderboard.map((entry: any) => entry.userId), ['deep', 'fast']);
});
