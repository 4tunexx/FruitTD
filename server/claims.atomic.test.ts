import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test, type TestContext } from 'node:test';
import express from 'express';
import { defaultSave } from '../src/game/save';
import { createDailyRouter } from './routes/daily';
import { createMissionsRouter } from './routes/missions';
import { createAchievementsRouter } from './routes/achievements';
import { createProfileRouter } from './routes/profile';

const user = { userId: 'claim-user', nickname: 'Slicer', avatar: '', createdAt: new Date(), updatedAt: new Date() };

function getPath(target: any, path: string): any {
  return path.split('.').reduce((value, part) => value?.[part], target);
}

function setPath(target: any, path: string, value: any): void {
  const parts = path.split('.');
  const leaf = parts.pop()!;
  let current = target;
  for (const part of parts) current = current[part] ??= {};
  current[leaf] = value;
}

function evaluate(value: any, doc: any): any {
  if (Array.isArray(value)) return value.map((item) => evaluate(item, doc));
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return typeof value === 'string' && value.startsWith('$') ? getPath(doc, value.slice(1)) : value;
  }
  if ('$ifNull' in value) return evaluate(value.$ifNull[0], doc) ?? evaluate(value.$ifNull[1], doc);
  if ('$add' in value) return evaluate(value.$add[0], doc) + evaluate(value.$add[1], doc);
  if ('$min' in value) return Math.min(...evaluate(value.$min, doc));
  if ('$setUnion' in value) return [...new Set(evaluate(value.$setUnion, doc).flat())];
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, evaluate(child, doc)]));
}

function claimHarness(claimCollectionName: 'daily_bonus' | 'missions' | 'achievements', initialClaimDoc?: any, initialWallet?: any) {
  const state: { cloud: any; claim: any } = {
    cloud: initialWallet ? { userId: user.userId, saveData: structuredClone(initialWallet), revision: 7, claimReceipts: [], updatedAt: new Date() } : null,
    claim: initialClaimDoc ? { ...initialClaimDoc } : null,
  };
  const walletCollection = {
    findOne: async ({ userId }: any) => state.cloud?.userId === userId ? state.cloud : null,
    insertOne: async (doc: any) => {
      if (state.cloud) throw Object.assign(new Error('duplicate'), { code: 11000 });
      state.cloud = structuredClone(doc);
    },
    findOneAndUpdate: async (filter: any, pipeline: any[]) => {
      if (!state.cloud || state.cloud.userId !== filter.userId || state.cloud.claimReceipts?.includes(filter.claimReceipts.$ne)) return null;
      const updates = evaluate(pipeline[0].$set, state.cloud);
      for (const [path, value] of Object.entries(updates)) setPath(state.cloud, path, value);
      return structuredClone(state.cloud);
    },
  };
  const markerCollection = {
    findOne: async (query: any) => {
      const doc = state.claim;
      if (!doc) return null;
      if (claimCollectionName === 'daily_bonus') return doc.userId === query.userId ? doc : null;
      if (claimCollectionName === 'missions') return doc.userId === query.userId && doc.missionId === query.missionId ? doc : null;
      return doc.userId === query.userId && doc.achievementId === query.achievementId ? doc : null;
    },
    updateOne: async (filter: any, update: any, options?: any) => {
      if (claimCollectionName === 'daily_bonus') {
        if (state.claim?.userId === filter.userId && state.claim.lastClaimDate === filter.lastClaimDate.$ne) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        state.claim = { ...(state.claim || {}), ...filter, ...update.$set, totalClaimed: (state.claim?.totalClaimed || 0) + (update.$inc?.totalClaimed || 0), userId: filter.userId };
        return { matchedCount: initialClaimDoc ? 1 : 0, modifiedCount: 1, upsertedCount: options?.upsert ? 1 : 0 };
      }
      if (!state.claim || (filter.claimed?.$ne === true && state.claim.claimed === true)) return { matchedCount: 0, modifiedCount: 0 };
      Object.assign(state.claim, update.$set);
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
  const missionDef = { id: 'daily-slice', type: 'daily' as const, title: 'Slice', desc: 'Slice fruit', icon: 'F', enabled: true, requirement: { type: 'slice_any', goal: 1 }, rewardCoins: 30, rewardSp: 2 };
  const achievementDef = { id: 'first-slice', title: 'First Slice', desc: 'Slice once', icon: '1', enabled: true, requirement: { type: 'slice_any', goal: 1 }, rewardCoins: 40, rewardSp: 1 };
  const catalog = async () => ({ missions: [missionDef], achievements: [achievementDef], badges: [], ranks: [], slicers: [] }) as Awaited<ReturnType<typeof import('./catalog').loadQuestCatalog>>;
  const resolveUser = async () => user;
  const collection = async (name: string) => name === 'cloud_saves' ? walletCollection as any : markerCollection as any;
  const router = claimCollectionName === 'daily_bonus'
    ? createDailyRouter({ resolveUser, collection, rewards: async () => [{ day: 1, coins: 25, skillPoints: 1, gems: 3, skinUnlock: 'blade-gold', label: 'Daily', iconType: 'gem' }], allowedSkinIds: async () => new Set(['blade-default', 'blade-gold', 'wall-brick']) })
    : claimCollectionName === 'missions'
      ? createMissionsRouter({ resolveUser, collection, catalog })
      : createAchievementsRouter({ resolveUser, collection, catalog });

  return { router, state, collection: async (name: string) => name === 'cloud_saves' ? walletCollection as any : markerCollection as any };
}

async function listen(route: express.Router, path: string): Promise<{ server: Server; base: string }> {
  const app = express();
  app.use(express.json());
  app.use(path, route);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Test server failed to bind');
  return { server, base: `http://127.0.0.1:${addr.port}${path}` };
}

function closeAfter(t: TestContext, server: Server): void {
  t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
}

for (const claimType of ['daily_bonus', 'missions', 'achievements'] as const) {
  test(`${claimType} parallel claims credit once and profile read returns the authoritative wallet`, async (t) => {
    const initial = claimType === 'daily_bonus'
      ? undefined
      : claimType === 'missions'
        ? { _id: 'mission-1', userId: user.userId, missionId: 'daily-slice', dayKey: '2026-09-29', progress: 1, goal: 1, completed: true, claimed: false }
        : { _id: 'achievement-1', userId: user.userId, achievementId: 'first-slice', unlocked: true, claimed: false, progress: 1, maxProgress: 1 };
    const harness = claimHarness(claimType, initial);
    const path = claimType === 'daily_bonus' ? '/api/daily' : claimType === 'missions' ? '/api/missions' : '/api/achievements';
    const { server, base } = await listen(harness.router, path);
    closeAfter(t, server);
    const body = claimType === 'daily_bonus' ? {} : claimType === 'missions' ? { missionId: 'daily-slice' } : { achievementId: 'first-slice' };
    const request = () => fetch(`${base}/claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const results = await Promise.all([request(), request()]);
    assert.equal(results.filter((response) => response.status === 200).length, 1);
    assert.equal(results.filter((response) => response.status !== 200).length, 1);

    const profile = await listen(createProfileRouter({
      resolveUser: async () => user,
      allowedSkinIds: async () => new Set(['blade-default', 'blade-gold', 'wall-brick']),
      collection: harness.collection,
    }), '/api/profile');
    closeAfter(t, profile.server);
    const read = await fetch(profile.base);
    const { saveData, revision } = await read.json();
    assert.equal(revision, 1);
    if (claimType === 'daily_bonus') {
      assert.equal(saveData.coins, 25);
      assert.equal(saveData.gems, 3);
      assert.equal(saveData.skillPoints, 1);
      assert.ok(saveData.ownedSkins.includes('blade-gold'));
    } else if (claimType === 'missions') {
      assert.equal(saveData.coins, 30);
      assert.equal(saveData.skillPoints, 2);
    } else {
      assert.equal(saveData.coins, 40);
      assert.equal(saveData.skillPoints, 1);
    }
  });
}

test('daily claim caps authoritative wallet values instead of overflowing them', async (t) => {
  const highWallet = { ...defaultSave(), coins: 999_990, gems: 999_999, skillPoints: 9_999 };
  const harness = claimHarness('daily_bonus', undefined, highWallet);
  const { server, base } = await listen(harness.router, '/api/daily');
  closeAfter(t, server);
  const response = await fetch(`${base}/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.saveData.coins, 1_000_000);
  assert.equal(body.saveData.gems, 1_000_000);
  assert.equal(body.saveData.skillPoints, 10_000);
  assert.equal(body.revision, 8);
});
