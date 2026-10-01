import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import { test } from 'node:test';
import { createMissionsRouter } from './routes/missions';

test('mission progress uses lifetime keys for main missions and reports first completion once', async (t) => {
  const rows = new Map<string, any>();
  const collection = async () => ({
    findOne: async ({ missionId, dayKey }: any) => rows.get(`${missionId}:${dayKey}`) ?? null,
    updateOne: async ({ missionId, dayKey }: any, update: any) => {
      rows.set(`${missionId}:${dayKey}`, { missionId, dayKey, ...update.$set, claimed: false });
      return { modifiedCount: 1, upsertedCount: 1 };
    },
  }) as any;
  const router = createMissionsRouter({
    resolveUser: async () => ({ userId: 'tester', nickname: 'Tester', avatar: '', createdAt: new Date(), updatedAt: new Date() }),
    collection,
    catalog: async () => ({
      missions: [{ id: 'main_one', type: 'main', title: 'Main', desc: '', icon: 'Swords', enabled: true, requirement: { type: 'slice_any', goal: 1 }, rewardCoins: 10, rewardSp: 0 }],
      achievements: [], badges: [], ranks: [], slicers: [],
    }) as any,
  });
  const app = express(); app.use(express.json()); app.use('/missions', router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/missions/progress`;
  const request = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: [{ missionId: 'main_one', progressDelta: 1 }] }) });
  const first = await (await request()).json();
  assert.deepEqual(first.newlyCompleted, ['main_one']);
  assert.equal(rows.get('main_one:MAIN')?.completed, true);
  const repeat = await (await request()).json();
  assert.deepEqual(repeat.newlyCompleted, []);
});
