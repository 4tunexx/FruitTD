import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test, type TestContext } from 'node:test';
import express from 'express';
import { DEFAULT_SLICERS } from '../src/game/slicers';
import { defaultSave } from '../src/game/save';
import { createItemsRouter, type ItemsRouteDeps } from './routes/items';

const user = { userId: 'economy-user', nickname: 'Slicer', avatar: '', createdAt: new Date(), updatedAt: new Date() };

async function listen(router: express.Router): Promise<{ server: Server; base: string }> {
  const app = express();
  app.use(express.json());
  app.use('/api/items', router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind test server');
  return { server, base: `http://127.0.0.1:${address.port}/api/items/action` };
}

function closeAfter(t: TestContext, server: Server): void {
  t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
}

function setup() {
  const cloud: any = { userId: user.userId, saveData: { ...defaultSave(), gems: 2000, skillPoints: 2 }, revision: 4, updatedAt: new Date() };
  const config = { configKey: 'game_config', vipTiers: [{ tier: 'bronze', price: 700 }] };
  const cloudCollection = {
    findOne: async ({ userId }: any) => userId === cloud.userId ? cloud : null,
    updateOne: async (filter: any, update: any) => {
      if (filter.userId !== cloud.userId || filter.revision !== cloud.revision) return { matchedCount: 0 };
      Object.assign(cloud, update.$set);
      return { matchedCount: 1 };
    },
  };
  const configCollection = { findOne: async () => config };
  const deps: ItemsRouteDeps = {
    resolveUser: async () => user,
    collection: async (name: string) => (name === 'cloud_saves' ? cloudCollection : configCollection) as any,
    slicers: async () => [],
  };
  return { deps, cloud };
}

test('VIP purchase uses the configured gem cost and credits coins atomically', async (t) => {
  const { deps, cloud } = setup();
  const { server, base } = await listen(createItemsRouter(deps));
  closeAfter(t, server);
  const response = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'buy-vip', id: 'bronze' }),
  });
  assert.equal(response.status, 200);
  assert.equal(cloud.revision, 5);
  assert.equal(cloud.saveData.gems, 1300);
  assert.equal(cloud.saveData.coins, 1000);
  assert.equal(cloud.saveData.vipStatus, 'bronze');

  const duplicate = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'buy-vip', id: 'bronze' }),
  });
  assert.equal(duplicate.status, 409);
  assert.equal(cloud.saveData.coins, 1000);
});

test('skill purchase spends server-owned skill points and survives a wallet read', async (t) => {
  const { deps, cloud } = setup();
  const { server, base } = await listen(createItemsRouter(deps));
  closeAfter(t, server);
  const response = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'buy-skill', id: 'edge' }),
  });
  assert.equal(response.status, 200);
  assert.equal(cloud.saveData.skillPoints, 1);
  assert.equal(cloud.saveData.skills.edge, 1);
  assert.equal(cloud.revision, 5);
});

test('a successful server action fills missing currency fields on a legacy wallet', async (t) => {
  const { deps, cloud } = setup();
  delete cloud.saveData.gems;
  const { server, base } = await listen(createItemsRouter(deps));
  closeAfter(t, server);

  const response = await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'buy-skill', id: 'edge' }),
  });

  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.saveData.gems, 0);
  assert.equal(cloud.saveData.gems, 0);
});


test('gear purchase, equip, unequip and sale persist without auto-equipping or duplicate credits', async (t) => {
  const { deps, cloud } = setup();
  deps.slicers = async () => DEFAULT_SLICERS;
  cloud.saveData.coins = 1000;
  const { server, base } = await listen(createItemsRouter(deps));
  closeAfter(t, server);
  const action = async (action: string, id = 'blade-gold') => {
    const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id }) });
    return { status: response.status, body: await response.json() as any };
  };
  assert.equal((await action('equip')).status, 403);
  const bought = await action('buy');
  assert.equal(bought.status, 200);
  assert.equal(bought.body.saveData.coins, 820);
  assert.equal(cloud.saveData.bladeSkin, 'blade-default');
  assert.equal((await action('buy')).status, 409);
  assert.equal((await action('equip')).body.saveData.bladeSkin, 'blade-gold');
  const persisted = await (await deps.collection<any>('cloud_saves')).findOne({ userId: user.userId });
  assert.equal(persisted?.saveData.bladeSkin, 'blade-gold');
  assert.equal((await action('unequip')).body.saveData.bladeSkin, '');
  await action('equip');
  const sold = await action('sell');
  assert.equal(sold.status, 200);
  assert.equal(sold.body.saveData.coins, 880);
  assert.equal(sold.body.saveData.bladeSkin, '');
  assert.equal(sold.body.saveData.ownedSkins.includes('blade-gold'), false);
  assert.equal((await action('sell')).status, 403);
  assert.equal((await action('equip')).status, 403);
  assert.equal(cloud.saveData.coins, 880);
  assert.equal((await action('sell', 'blade-default')).status, 422);
});

test('malformed or profitable resale pricing cannot mutate a wallet', async (t) => {
  const { deps, cloud } = setup();
  const blade = { ...DEFAULT_SLICERS[1] };
  deps.slicers = async () => [blade];
  cloud.saveData.coins = 1000;
  cloud.saveData.ownedSkins.push(blade.id);
  const before = structuredClone(cloud);
  const { server, base } = await listen(createItemsRouter(deps));
  closeAfter(t, server);
  for (const [cost, sellValue] of [[100, 101], [0.5, 0], [-1, 0], [100, 0.5], [100, -1], [1000001, 0], [NaN, 0]]) {
    Object.assign(blade, { cost, sellValue });
    for (const action of ['buy', 'sell']) {
      const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id: blade.id }) });
      assert.equal(response.status, 422);
      assert.deepEqual(cloud, before);
    }
  }
});
