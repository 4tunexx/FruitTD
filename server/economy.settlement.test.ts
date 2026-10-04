import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test, type TestContext } from 'node:test';
import express from 'express';
import { defaultSave } from '../src/game/save';
import { DEFAULT_RANK_TIERS } from '../src/game/requirements';
import { createLeaderboardRouter, type LeaderboardRouteDeps } from './routes/leaderboard';

const user = { userId: 'settle-user', nickname: 'Slicer', avatar: '', createdAt: new Date(), updatedAt: new Date() };
const getPath = (obj: any, path: string) => path.split('.').reduce((value, part) => value?.[part], obj);
function evaluate(value: any, doc: any): any {
  if (typeof value === 'string' && value.startsWith('$')) return getPath(doc, value.slice(1));
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if ('$ifNull' in value) return evaluate(value.$ifNull[0], doc) ?? evaluate(value.$ifNull[1], doc);
  if ('$add' in value) return value.$add.reduce((sum: number, part: any) => sum + Number(evaluate(part, doc) || 0), 0);
  if ('$min' in value) return Math.min(...value.$min.map((part: any) => evaluate(part, doc)));
  if ('$max' in value) return Math.max(...value.$max.map((part: any) => evaluate(part, doc)));
  if ('$setUnion' in value) return [...new Set(value.$setUnion.flatMap((part: any) => evaluate(part, doc)))];
  return value;
}
function setPath(obj: any, path: string, value: any) {
  const parts = path.split('.');
  const key = parts.pop()!;
  const parent = parts.reduce((node, part) => node[part] ??= {}, obj);
  parent[key] = value;
}

async function listen(router: express.Router): Promise<{ server: Server; base: string }> {
  const app = express();
  app.use(express.json());
  app.use('/api/leaderboard', router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind test server');
  return { server, base: `http://127.0.0.1:${address.port}/api/leaderboard` };
}

function closeAfter(t: TestContext, server: Server): void {
  t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
}

function setup(): { deps: LeaderboardRouteDeps; wallet: any } {
  const runs: any[] = [];
  const leaders: any[] = [];
  const wallet: any = { userId: user.userId, saveData: defaultSave(), revision: 2, claimReceipts: [], updatedAt: new Date() };
  const runTokens = {
    insertOne: async (doc: any) => { runs.push(doc); },
    findOneAndUpdate: async (filter: any, update: any) => {
      const found = runs.find((run) => run.tokenHash === filter.tokenHash && run.userId === filter.userId && run.mode === filter.mode && run.expiresAt > filter.expiresAt.$gt && !run.consumedAt);
      if (!found) return null;
      Object.assign(found, update.$set);
      return found;
    },
  };
  const leaderboard = {
    findOne: async (filter: any) => leaders.find((entry) => entry.userId === filter.userId && entry.mode === filter.mode) ?? null,
    insertOne: async (doc: any) => { leaders.push(doc); },
    updateOne: async () => ({ matchedCount: 1 }),
    countDocuments: async () => 0,
  };
  const cloudSaves = {
    findOne: async () => wallet,
    findOneAndUpdate: async (filter: any, pipeline: any[]) => {
      if (wallet.claimReceipts.includes(filter.claimReceipts.$ne)) return null;
      for (const [path, expression] of Object.entries(pipeline[0].$set)) setPath(wallet, path, evaluate(expression, wallet));
      return wallet;
    },
  };
  return {
    wallet,
    deps: {
      resolveUser: async () => user,
      collection: async (name: string) => (name === 'run_tokens' ? runTokens : name === 'cloud_saves' ? cloudSaves : leaderboard) as any,
      catalog: async () => ({ missions: [], achievements: [], badges: [], ranks: DEFAULT_RANK_TIERS, slicers: [] }),
    },
  };
}

test('a consumed run settles bounded kill, wave, and match rewards into the cloud wallet', async (t) => {
  const { deps, wallet } = setup();
  const { server, base } = await listen(createLeaderboardRouter(deps));
  closeAfter(t, server);
  const start = await fetch(`${base}/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'ranked' }),
  });
  const { runToken } = await start.json();
  const score = { nickname: 'Slicer', hero: 'jiju', mode: 'ranked', score: 2000, wave: 5, fruitsSliced: 20, maxCombo: 5 };
  const settled = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...score, runToken, rewards: { coins: 200, gems: 1, heroXp: 40, towerXp: 60, skillPoints: 1 } }),
  });
  assert.equal(settled.status, 200);
  const body = await settled.json();
  assert.equal(body.wallet.saveData.coins, 200);
  assert.equal(body.wallet.saveData.gems, 1);
  assert.equal(body.wallet.saveData.skillPoints, 1);
  assert.equal(wallet.saveData.xp.jiju, 40);
  assert.equal(wallet.saveData.towerXp, 60);
  assert.equal(wallet.saveData.games, 1);
  assert.ok(wallet.claimReceipts.some((receipt: string) => receipt.startsWith('run:')));

  const rank = await fetch(`${base}/monthly-rank`);
  const rankState = await rank.json();
  assert.equal(rankState.hasEntry, true);
  assert.equal(rankState.claimed, false);
  const rankClaim = await fetch(`${base}/monthly-rank/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(rankClaim.status, 200);
  assert.equal(wallet.saveData.coins, 450, 'Silver rank prize is added to the match reward wallet');
  assert.equal(wallet.saveData.gems, 6, 'rank gems are credited alongside the boss gem');
  const bronzeClaim = await fetch(`${base}/monthly-rank/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rankId: 'bronze' }) });
  assert.equal(bronzeClaim.status, 200, 'previously reached rank prizes remain claimable after ranking up');
  assert.equal(wallet.saveData.coins, 550);
  const repeatedRankClaim = await fetch(`${base}/monthly-rank/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(repeatedRankClaim.status, 409);

  const replay = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...score, runToken, rewards: { coins: 200, gems: 1, heroXp: 40, towerXp: 60, skillPoints: 1 } }),
  });
  assert.equal(replay.status, 401);
  assert.equal(wallet.saveData.coins, 550);
});

test('leaving Ranked settles earned currency without granting a monthly placement', async (t) => {
  const { deps, wallet } = setup();
  const { server, base } = await listen(createLeaderboardRouter(deps));
  closeAfter(t, server);
  const start = await fetch(`${base}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'ranked' }) });
  const { runToken } = await start.json();
  const settled = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    nickname: 'Slicer', hero: 'jiju', mode: 'ranked', score: 1500, wave: 3, fruitsSliced: 10, maxCombo: 3,
    runToken, completed: false, rewards: { coins: 20, gems: 0, heroXp: 10, towerXp: 10, skillPoints: 0 },
  }) });
  assert.equal(settled.status, 200);
  assert.equal(wallet.saveData.coins, 20);
  assert.equal(wallet.saveData.rankedScore, 0);
  const monthly = await (await fetch(`${base}/monthly-rank`)).json();
  assert.equal(monthly.hasEntry, false);
});

test('a rare fruit gem settles only after the run records 100 kills', async (t) => {
  const { deps, wallet } = setup();
  const { server, base } = await listen(createLeaderboardRouter(deps));
  closeAfter(t, server);
  const start = await fetch(`${base}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'casual' }) });
  const { runToken } = await start.json();
  const rewards = { coins: 3, gems: 1, heroXp: 4, towerXp: 4, skillPoints: 0 };
  const send = (fruitsSliced: number) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: 'Slicer', hero: 'jiju', mode: 'casual', score: 1200, wave: 1, fruitsSliced, runToken, rewards }) });
  assert.equal((await send(99)).status, 422);
  assert.equal((await send(100)).status, 200);
  assert.equal(wallet.saveData.gems, 1);
});

test('run settlement rejects rewards beyond the score and wave allowance', async (t) => {
  const { deps, wallet } = setup();
  const { server, base } = await listen(createLeaderboardRouter(deps));
  closeAfter(t, server);
  const start = await fetch(`${base}/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'casual' }),
  });
  const { runToken } = await start.json();
  const response = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'casual', score: 10, wave: 1, runToken, rewards: { coins: 1000, heroXp: 1, towerXp: 1, skillPoints: 0 } }),
  });
  assert.equal(response.status, 422);
  assert.equal(wallet.saveData.coins, 0);
});

test('a freshly issued run token cannot settle an impossible score and wallet reward', async (t) => {
  const { deps, wallet } = setup();
  const { server, base } = await listen(createLeaderboardRouter(deps));
  closeAfter(t, server);
  const start = await fetch(`${base}/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'casual' }),
  });
  const { runToken } = await start.json();
  const forged = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'casual', score: 100_000, wave: 200, fruitsSliced: 10_000, maxCombo: 300,
      runToken, rewards: { coins: 10_000, gems: 100, heroXp: 1000, towerXp: 1000, skillPoints: 20 } }),
  });
  assert.equal(forged.status, 422);
  assert.equal(wallet.saveData.coins, 0);
  assert.equal(wallet.saveData.gems, 0);
});
