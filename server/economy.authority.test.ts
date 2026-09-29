import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test, type TestContext } from 'node:test';
import express from 'express';
import { defaultSave } from '../src/game/save';
import { createProfileRouter, type ProfileRouteDeps } from './routes/profile';
import { createLeaderboardRouter, type LeaderboardRouteDeps } from './routes/leaderboard';

const user = {
  userId: 'authority-user', nickname: 'Slicer', avatar: '', createdAt: new Date(), updatedAt: new Date(),
};

async function listen(router: express.Router, path: string): Promise<{ server: Server; base: string }> {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind test server');
  return { server, base: `http://127.0.0.1:${address.port}${path}` };
}

function closeAfter(t: TestContext, server: Server): void {
  t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
}

function profileDeps(revision = 2): { deps: ProfileRouteDeps; cloud: any } {
  const cloud = { userId: user.userId, saveData: defaultSave(), revision, updatedAt: new Date() };
  const cloudCollection = {
    findOne: async ({ userId }: any) => userId === cloud.userId ? cloud : null,
    insertOne: async (doc: any) => Object.assign(cloud, doc),
    updateOne: async (filter: any, update: any) => {
      const revisionMatches = filter.revision?.$exists === false ? cloud.revision === undefined : filter.revision === cloud.revision;
      if (filter.userId !== cloud.userId || !revisionMatches) return { matchedCount: 0 };
      Object.assign(cloud, update.$set);
      return { matchedCount: 1 };
    },
  };
  const usersCollection = {
    findOne: async () => user,
    updateOne: async () => ({ matchedCount: 1 }),
  };
  return {
    cloud,
    deps: {
      resolveUser: async () => user,
      allowedSkinIds: async () => new Set(['blade-default', 'blade-gold', 'wall-brick']),
      collection: async (name: string) => (name === 'cloud_saves' ? cloudCollection : usersCollection) as any,
    },
  };
}

test('profile sync rejects a stale or missing server revision and accepts the current revision', async (t) => {
  const { deps, cloud } = profileDeps(2);
  const { server, base } = await listen(createProfileRouter(deps), '/api/profile');
  closeAfter(t, server);

  const stale = await fetch(`${base}/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: 1, saveData: defaultSave() }),
  });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).revision, 2);

  const missing = await fetch(`${base}/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saveData: defaultSave() }),
  });
  assert.equal(missing.status, 428);

  const legitimate = await fetch(`${base}/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: 2, saveData: { ...defaultSave(), nickname: 'Fresh Lime', mode: 'campaign', campaignProgress: { unlocked: 3, cleared: [1, 2] } } }),
  });
  assert.equal(legitimate.status, 200);
  assert.equal((await legitimate.json()).revision, 3);
  assert.equal(cloud.revision, 3);
  assert.equal(cloud.saveData.nickname, 'Fresh Lime');
  assert.deepEqual(cloud.saveData.campaignProgress, { unlocked: 3, cleared: [1, 2] });
  assert.equal(cloud.saveData.mode, 'campaign');
});

test('profile sync rejects forged catalog ownership and in-cap balances', async (t) => {
  const { deps, cloud } = profileDeps(4);
  const { server, base } = await listen(createProfileRouter(deps), '/api/profile');
  closeAfter(t, server);

  const unknownOwnership = await fetch(`${base}/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: 4, saveData: { ...defaultSave(), ownedSkins: ['blade-default', 'wall-brick', 'blade-admin-forged'] } }),
  });
  assert.equal(unknownOwnership.status, 400);

  const knownButUnearned = await fetch(`${base}/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: 4, saveData: { ...defaultSave(), ownedSkins: ['blade-default', 'wall-brick', 'blade-gold'] } }),
  });
  assert.equal(knownButUnearned.status, 422);

  cloud.saveData.ownedSkins.push('blade-gold');
  const forgedEquipment = await fetch(`${base}/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: 4, saveData: { ...cloud.saveData, bladeSkin: 'blade-gold' } }),
  });
  assert.equal(forgedEquipment.status, 422, 'loadout slots can only change through an item action');

  const forgedCoins = await fetch(`${base}/sync`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: 4, saveData: { ...defaultSave(), coins: 999_999 } }),
  });
  assert.equal(forgedCoins.status, 422);
});

function leaderboardDeps(): LeaderboardRouteDeps {
  const runs: any[] = [];
  const leaders: any[] = [];
  const runCollection = {
    insertOne: async (doc: any) => { runs.push(doc); },
    findOneAndUpdate: async (filter: any, update: any) => {
      const found = runs.find((run) => run.tokenHash === filter.tokenHash && run.userId === filter.userId && run.mode === filter.mode && run.expiresAt > filter.expiresAt.$gt && !run.consumedAt);
      if (!found) return null;
      Object.assign(found, update.$set);
      return found;
    },
  };
  const leaderboardCollection = {
    findOne: async (filter: any) => leaders.find((entry) => entry.userId === filter.userId && entry.mode === filter.mode) ?? null,
    insertOne: async (doc: any) => { leaders.push(doc); },
    updateOne: async () => ({ matchedCount: 1 }),
    countDocuments: async () => 0,
  };
  return {
    resolveUser: async () => user,
    collection: async (name: string) => (name === 'run_tokens' ? runCollection : leaderboardCollection) as any,
    catalog: async () => ({ missions: [], achievements: [], badges: [], ranks: [], slicers: [] }),
  };
}

test('leaderboard requires and consumes a server-issued run token', async (t) => {
  const { server, base } = await listen(createLeaderboardRouter(leaderboardDeps()), '/api/leaderboard');
  closeAfter(t, server);
  const score = { nickname: 'Slicer', hero: 'jiju', mode: 'casual', score: 2500, wave: 4, fruitsSliced: 20, maxCombo: 5 };

  const withoutToken = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(score),
  });
  assert.equal(withoutToken.status, 401);

  const start = await fetch(`${base}/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'casual' }),
  });
  assert.equal(start.status, 201);
  const { runToken } = await start.json();

  const legitimate = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...score, runToken }),
  });
  assert.equal(legitimate.status, 200);

  const replay = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...score, runToken }),
  });
  assert.equal(replay.status, 401, 'run tokens must be single-use');

  for (const mode of ['horde', 'campaign']) {
    const startModeRun = await fetch(`${base}/run`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
    });
    assert.equal(startModeRun.status, 201, `${mode} must receive a real server run token`);
    const { runToken: modeToken } = await startModeRun.json();
    const modeResult = await fetch(base, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...score, mode, wave: 10, runToken: modeToken }),
    });
    assert.equal(modeResult.status, 200, `${mode} scores should use their own authorized mode path`);
  }
});
