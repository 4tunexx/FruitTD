import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test, type TestContext } from 'node:test';
import express from 'express';
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
