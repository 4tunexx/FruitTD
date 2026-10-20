import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test, type TestContext } from 'node:test';
import express from 'express';
import { createMissionsRouter } from './routes/missions';
import { createAchievementsRouter } from './routes/achievements';
import { createBadgesRouter } from './routes/badges';
import { defaultSave } from '../src/game/save';

const user = { userId: 'tester', nickname: 'Tester', avatar: '', createdAt: new Date(), updatedAt: new Date() };
const main = { id: 'old_daily', type: 'main', title: 'Permanent', requirement: { type: 'slice_any', goal: 10 }, rewardCoins: 10 };
const daily = { ...main, id: 'daily', type: 'daily' };
const achievement = { ...main, id: 'achievement' };
const badge = { ...main, id: 'badge', rewardGems: 1 };
function matches(doc: any, filter: any): boolean {
  return Object.entries(filter).every(([key, value]: [string, any]) =>
    value && typeof value === 'object' && '$ne' in value ? doc[key] !== value.$ne : doc[key] === value);
}
function evaluate(expr: any, doc: any): any {
  if (typeof expr === 'string' && expr.startsWith('$')) return expr.slice(1).split('.').reduce((v, k) => v?.[k], doc);
  if (Array.isArray(expr)) return expr.map(v => evaluate(v, doc));
  if (!expr || typeof expr !== 'object' || expr instanceof Date) return expr;
  if ('$ifNull' in expr) return evaluate(expr.$ifNull[0], doc) ?? evaluate(expr.$ifNull[1], doc);
  if ('$add' in expr) return evaluate(expr.$add, doc).reduce((a: number, b: number) => a + b, 0);
  if ('$min' in expr) return Math.min(...evaluate(expr.$min, doc));
  if ('$setUnion' in expr) return [...new Set(evaluate(expr.$setUnion, doc).flat())];
  return expr;
}
async function harness(t: TestContext) {
  const rows: Record<string, any[]> = { missions: [], achievements: [], badges: [], notifications: [] };
  const wallet = { userId: user.userId, saveData: defaultSave(), revision: 0, claimReceipts: [] as string[], updatedAt: new Date() };
  let markerFailure = false;
  const collection = async (name: string): Promise<any> => name === 'cloud_saves' ? {
    findOne: async () => structuredClone(wallet),
    findOneAndUpdate: async (filter: any, pipeline: any[]) => {
      if (wallet.claimReceipts.includes(filter.claimReceipts.$ne)) return null;
      const updates = Object.fromEntries(Object.entries(pipeline[0].$set).map(([k, v]) => [k, evaluate(v, wallet)]));
      for (const [path, value] of Object.entries(updates)) {
        const keys = path.split('.'); let parent: any = wallet;
        for (const key of keys.slice(0, -1)) parent = parent[key] ??= {};
        parent[keys.at(-1)!] = value;
      }
      return structuredClone(wallet);
    },
  } : {
    find: (filter: any) => ({ toArray: async () => structuredClone(rows[name].filter(doc => matches(doc, filter))) }),
    findOne: async (filter: any) => structuredClone(rows[name].find(doc => matches(doc, filter)) ?? null),
    updateOne: async (filter: any, update: any, options: any) => {
      if (markerFailure && update.$set?.claimed) throw new Error('Simulated marker outage');
      let doc = rows[name].find(doc => matches(doc, filter));
      if (!doc && options?.upsert) { doc = { ...filter, _id: `${name}-${rows[name].length}`, ...update.$setOnInsert }; rows[name].push(doc); }
      if (!doc) return { matchedCount: 0, modifiedCount: 0 };
      Object.assign(doc, update.$set);
      for (const [key, value] of Object.entries(update.$max ?? {})) {
        if (doc[key] === undefined || doc[key] < value!) doc[key] = value;
      }
      return { matchedCount: 1, modifiedCount: 1 };
    },
    insertOne: async (doc: any) => { rows[name].push(doc); },
  };
  const deps = { collection, resolveUser: async () => user, catalog: async () => ({ missions: [main, daily], achievements: [achievement], badges: [badge], ranks: [], slicers: [] }) as any };
  const app = express(); app.use(express.json());
  app.use('/missions', createMissionsRouter(deps));
  app.use('/achievements', createAchievementsRouter(deps));
  app.use('/badges', createBadgesRouter(deps));
  const server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const request = async (path: string, body?: any) => {
    const res = await fetch(`http://127.0.0.1:${address.port}${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    return { status: res.status, body: await res.json(), cache: res.headers.get('cache-control') };
  };
  return { rows, wallet, request, failMarker: () => { markerFailure = true; } };
}

test('converted main missions retain old daily/weekly completion and claims, across later days', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-20T12:00:00Z') });
  const h = await harness(t);
  h.rows.missions.push({ userId: user.userId, missionId: main.id, dayKey: '2026-W38', progress: 10, completed: true, claimed: true });
  for (const now of ['2026-10-20', '2026-10-21', '2026-11-01']) {
    t.mock.timers.setTime(new Date(`${now}T12:00:00Z`).getTime());
    const listing = await h.request('/missions');
    assert.equal(listing.cache, 'private, no-store');
    assert.equal(listing.body.missions[0].claimed, true);
    assert.equal(listing.body.missions[0].completed, true);
    assert.equal((await h.request('/missions/claim', { missionId: main.id })).status, 400);
    assert.deepEqual((await h.request('/missions/progress', { updates: [{ missionId: main.id, progressDelta: 1 }] })).body.newlyCompleted, []);
  }
  assert.equal(h.wallet.saveData.coins, 0);
  assert.equal(h.rows.notifications.length, 0);
});

test('unclaimed legacy main completion carries forward, pays once, and remains claimed after midnight', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-20T12:00:00Z') });
  const h = await harness(t);
  h.rows.missions.push({ userId: user.userId, missionId: main.id, dayKey: '2026-09-15', progress: 10, completed: true, claimed: false });
  const responses = await Promise.all([h.request('/missions/claim', { missionId: main.id }), h.request('/missions/claim', { missionId: main.id })]);
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(h.wallet.saveData.coins, 10);
  assert.ok(h.wallet.claimReceipts.includes(`mission:MAIN:${main.id}`));
  t.mock.timers.setTime(new Date('2026-10-21T12:00:00Z').getTime());
  assert.equal((await h.request('/missions')).body.missions[0].claimed, true);
  assert.equal((await h.request('/missions/claim', { missionId: main.id })).status, 400);
});

test('only daily missions reset at UTC midnight; yesterday cannot supply today’s progress', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-20T23:59:00Z') });
  const h = await harness(t);
  const progress = () => h.request('/missions/progress', { updates: [{ missionId: daily.id, setProgress: 10 }] });
  const claim = () => h.request('/missions/claim', { missionId: daily.id });
  await progress(); assert.equal((await claim()).status, 200);
  assert.equal((await claim()).status, 400);
  t.mock.timers.setTime(new Date('2026-10-21T00:01:00Z').getTime());
  let current = (await h.request('/missions')).body.missions[1];
  assert.equal(current.claimed, false); assert.equal(current.progress, 0); assert.equal(current.completed, false);
  assert.equal((await claim()).status, 400);
  await progress(); assert.equal((await claim()).status, 200);
  current = (await h.request('/missions')).body.missions[1]; assert.equal(current.claimed, true);
  assert.equal(h.wallet.saveData.coins, 20);
});

for (const kind of ['missions', 'achievements', 'badges']) {
  test(`${kind}: payment receipts prevent re-offering rewards even when progress markers are stale or missing`, async t => {
    const h = await harness(t);
    const id = kind === 'missions' ? main.id : kind === 'achievements' ? achievement.id : badge.id;
    const receipt = kind === 'missions' ? `mission:2026-09-15:${id}` : `${kind === 'badges' ? 'badge' : 'achievement'}:${id}`;
    h.wallet.claimReceipts.push(receipt);
    const listing = await h.request(`/${kind}`);
    const item = listing.body[kind][0]; assert.equal(item.claimed, true);
    assert.equal(item.completed ?? item.unlocked, true);
    assert.equal(listing.cache, 'private, no-store');
    const key = kind === 'missions' ? 'missionId' : kind === 'achievements' ? 'achievementId' : 'badgeId';
    assert.notEqual((await h.request(`/${kind}/claim`, { [key]: id })).status, 200);
    const update = await h.request(`/${kind}/progress`, { updates: [{ [key]: id, setProgress: 10 }] });
    assert.deepEqual(update.body.newlyCompleted ?? update.body.newlyUnlocked, []);
    assert.equal(h.rows.notifications.length, 0); assert.equal(h.wallet.saveData.coins, 0);
  });
}

test('receipt truth survives an interrupted achievement marker write; retry cannot duplicate payment', async t => {
  const h = await harness(t);
  h.rows.achievements.push({ _id: 'a', userId: user.userId, achievementId: achievement.id, unlocked: true, progress: 10, claimed: false });
  h.failMarker();
  const paid = await h.request('/achievements/claim', { achievementId: achievement.id });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.saveData.coins, 10);
  assert.equal(h.wallet.saveData.coins, 10);
  assert.equal((await h.request('/achievements')).body.achievements[0].claimed, true);
  assert.equal((await h.request('/achievements/claim', { achievementId: achievement.id })).status, 400);
  assert.equal(h.wallet.saveData.coins, 10);
});

test('badge reward pays once under simultaneous claims and stays claimed on a later day', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-20T12:00:00Z') });
  const h = await harness(t);
  h.rows.badges.push({ userId: user.userId, badgeId: badge.id, progress: 10, unlocked: true });
  const claims = await Promise.all([h.request('/badges/claim', { badgeId: badge.id }), h.request('/badges/claim', { badgeId: badge.id })]);
  assert.equal(claims.filter(r => r.status === 200).length, 1);
  assert.equal(h.wallet.saveData.coins, 10); assert.equal(h.wallet.saveData.gems, 1);
  t.mock.timers.setTime(new Date('2026-10-21T12:00:00Z').getTime());
  assert.equal((await h.request('/badges')).body.badges[0].claimed, true);
  assert.equal((await h.request('/badges/claim', { badgeId: badge.id })).status, 409);
  assert.equal(h.wallet.saveData.coins, 10);
});
